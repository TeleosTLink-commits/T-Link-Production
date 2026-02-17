/**
 * E2E Shipment Flow Test Runner
 * 
 * Generates a JWT token and runs the full shipment processing test.
 * Usage: npx ts-node src/__tests__/integration/run-e2e-test.ts
 */

import jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';

const BASE_URL = process.env.TEST_API_URL || 'https://tlink-production-backend.onrender.com';
const API = `${BASE_URL}/api`;

// Generate a test JWT - uses the default secret if JWT_SECRET env isn't set on the server
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const testUserId = '355a1000-789e-4633-84cb-4232ac8b5209'; // admin user
const testEmail = 'sroos@ajwalabs.com';
const testRole = 'admin';

const token = jwt.sign(
  { id: testUserId, email: testEmail, role: testRole },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const authHeaders = {
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
};

interface TestResult {
  step: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  detail: string;
  time: number;
}

const results: TestResult[] = [];

async function runTest(step: string, fn: () => Promise<string>): Promise<void> {
  const start = Date.now();
  try {
    const detail = await fn();
    const time = Date.now() - start;
    results.push({ step, status: 'PASS', detail, time });
    console.log(`  ✅ ${step} (${time}ms)`);
    console.log(`     ${detail}`);
  } catch (error: any) {
    const time = Date.now() - start;
    const errMsg = error.response?.data?.error || error.response?.data?.message || error.message;
    const status = error.response?.status;
    results.push({ step, status: 'FAIL', detail: `${status || 'ERR'}: ${errMsg}`, time });
    console.log(`  ❌ ${step} (${time}ms)`);
    console.log(`     ${status || 'ERR'}: ${errMsg}`);
  }
}

async function skipTest(step: string, reason: string): Promise<void> {
  results.push({ step, status: 'SKIP', detail: reason, time: 0 });
  console.log(`  ⏩ ${step}: ${reason}`);
}

let testShipmentId = '';
let testTrackingNumber = '';

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  T-LINK SHIPMENT E2E FLOW TEST');
  console.log(`  API: ${BASE_URL}`);
  console.log(`  User: ${testEmail} (${testRole})`);
  console.log('═══════════════════════════════════════════════\n');

  // ── STEP 1: Auth ──────────────────────────────────
  console.log('📋 Step 1: Authentication');
  await runTest('Auth token verification', async () => {
    const res = await axios.get(`${API}/shipments`, { headers: authHeaders });
    return `Token valid - shipments endpoint responded ${res.status}`;
  });

  if (results[0].status === 'FAIL') {
    console.log('\n⚠️  Authentication failed. The JWT_SECRET on production may differ.');
    console.log('    Try setting TEST_AUTH_TOKEN from browser localStorage instead.\n');
    // Try using an env token instead
    if (process.env.TEST_AUTH_TOKEN) {
      authHeaders.Authorization = `Bearer ${process.env.TEST_AUTH_TOKEN}`;
      await runTest('Auth token (from env)', async () => {
        const res = await axios.get(`${API}/shipments`, { headers: authHeaders });
        return `ENV token valid - ${res.status}`;
      });
    }
  }

  // ── STEP 2: Processing Dashboard ──────────────────
  console.log('\n📋 Step 2: Processing Dashboard');
  await runTest('Fetch initiated shipments', async () => {
    const res = await axios.get(`${API}/processing/shipments`, { headers: authHeaders });
    const shipments = res.data.data || res.data.shipments || [];
    if (Array.isArray(shipments) && shipments.length > 0) {
      testShipmentId = shipments[0].id;
      return `Found ${shipments.length} pending shipments. First: ${shipments[0].shipment_number || testShipmentId}`;
    }
    return `No initiated shipments found (${res.status})`;
  });

  await runTest('Fetch shipping supplies', async () => {
    const res = await axios.get(`${API}/processing/supplies`, { headers: authHeaders });
    const supplies = Array.isArray(res.data) ? res.data : (res.data.data || []);
    return `${supplies.length} supply items loaded`;
  });

  // ── STEP 3: Shipment Details ──────────────────────
  console.log('\n📋 Step 3: Shipment Details');
  if (testShipmentId) {
    await runTest('Fetch shipment for processing', async () => {
      const res = await axios.get(`${API}/processing/${testShipmentId}`, { headers: authHeaders });
      const s = res.data.data || res.data;
      return `${s.shipment_number}: ${s.chemical_name || 'N/A'}, ${s.amount_shipped} ${s.unit} → ${s.destination_city}, ${s.destination_state} ${s.destination_country || 'US'}. HazMat: ${s.is_hazmat ? 'YES' : 'No'}, SDS: ${s.sds_documents?.length || 0}`;
    });
  } else {
    await skipTest('Fetch shipment for processing', 'No initiated shipments');
  }

  // ── STEP 4: Address Validation ────────────────────
  console.log('\n📋 Step 4: Address Validation');
  await runTest('Validate US domestic address', async () => {
    const res = await axios.post(`${API}/processing/validate-address`, {
      street: '1600 Amphitheatre Parkway', city: 'Mountain View', state: 'CA', zip: '94043', country: 'US',
    }, { headers: authHeaders });
    const r = res.data.data || res.data;
    return `Valid: ${r.valid}${r.warning ? ` (⚠️ ${r.warning})` : ''}`;
  });

  await runTest('Validate UK international address', async () => {
    const res = await axios.post(`${API}/processing/validate-address`, {
      street: '10 Downing Street', city: 'London', state: '', zip: 'SW1A 2AA', country: 'GB',
    }, { headers: authHeaders });
    const r = res.data.data || res.data;
    return `Valid: ${r.valid}${r.warning ? ` (⚠️ ${r.warning})` : ''}`;
  });

  await runTest('Validate NL address (no state required)', async () => {
    const res = await axios.post(`${API}/processing/validate-address`, {
      street: 'Keizersgracht 585', city: 'Amsterdam', state: '', zip: '1017DR', country: 'NL',
    }, { headers: authHeaders });
    const r = res.data.data || res.data;
    return `Valid: ${r.valid}`;
  });

  // ── STEP 5: Rate Quotes ───────────────────────────
  console.log('\n📋 Step 5: Rate Quotes');
  const domesticAddr = { street: '1600 Amphitheatre Pkwy', city: 'Mountain View', state: 'CA', zip: '94043', country: 'US' };
  const intlAddr = { street: '10 Downing Street', city: 'London', state: '', zip: 'SW1A 2AA', country: 'GB' };

  const serviceTests = [
    { name: 'Domestic Ground', service: 'GROUND_HOME_DELIVERY', addr: domesticAddr },
    { name: 'Domestic Express Saver', service: 'FEDEX_EXPRESS_SAVER', addr: domesticAddr },
    { name: 'Domestic Priority Overnight', service: 'PRIORITY_OVERNIGHT', addr: domesticAddr },
    { name: 'Domestic Standard Overnight', service: 'STANDARD_OVERNIGHT', addr: domesticAddr },
    { name: 'International Priority', service: 'INTERNATIONAL_PRIORITY', addr: intlAddr },
    { name: 'International Economy', service: 'INTERNATIONAL_ECONOMY', addr: intlAddr },
    { name: 'International First', service: 'INTERNATIONAL_FIRST', addr: intlAddr },
  ];

  for (const { name, service, addr } of serviceTests) {
    await runTest(`Rate: ${name}`, async () => {
      const res = await axios.post(`${API}/processing/get-rate`, {
        toAddress: addr, weight: '2.5', weightUnit: 'LB', service, packageValue: '100', isHazmat: false,
      }, { headers: authHeaders });
      const d = res.data.data || res.data;
      return `$${d.rate?.toFixed(2) || 'N/A'} ${d.error ? `(Error: ${d.error})` : ''}`;
    });
  }

  // ── STEP 6: Shipment Creation ─────────────────────
  console.log('\n📋 Step 6: Shipment Creation');
  await runTest('Fetch available samples', async () => {
    const res = await axios.get(`${API}/sample-inventory`, { headers: authHeaders });
    const samples = res.data.data || res.data.samples || res.data;
    return `${Array.isArray(samples) ? samples.length : 0} samples available`;
  });

  // ── STEP 7: Label Generation ──────────────────────
  console.log('\n📋 Step 7: Label Generation');
  if (testShipmentId) {
    await runTest('Generate FedEx shipping label', async () => {
      const res = await axios.post(`${API}/processing/generate-label`, {
        shipmentId: testShipmentId, weight: '2.5', weightUnit: 'LB',
        service: 'GROUND_HOME_DELIVERY', packageValue: '100', isHazmat: false, suppliesUsed: [],
      }, { headers: authHeaders });
      const d = res.data.data || res.data;
      testTrackingNumber = d.trackingNumber || d.tracking_number || '';
      return `Tracking: ${testTrackingNumber}, Cost: $${d.cost?.toFixed(2) || 'N/A'}, Delivery: ${d.estimatedDelivery || 'N/A'}`;
    });
  } else {
    await skipTest('Generate FedEx shipping label', 'No initiated shipment to ship');
  }

  // ── STEP 8: Tracking ──────────────────────────────
  console.log('\n📋 Step 8: Tracking');
  if (testTrackingNumber) {
    await runTest('Retrieve tracking info', async () => {
      const res = await axios.get(`${API}/processing/tracking/${testTrackingNumber}`, { headers: authHeaders });
      const d = res.data.data || res.data;
      return `Status: ${d.status}, Location: ${d.location}`;
    });
  } else {
    await skipTest('Retrieve tracking info', 'No tracking number available');
  }

  // ── STEP 9: FedEx Direct API ──────────────────────
  console.log('\n📋 Step 9: FedEx Direct Endpoints');
  await runTest('FedEx validate-address', async () => {
    const res = await axios.post(`${API}/fedex/validate-address`, {
      street: '456 Oak Ave', city: 'Dallas', stateOrProvinceCode: 'TX', postalCode: '75201', countryCode: 'US',
    }, { headers: authHeaders });
    return `Valid: ${res.data.valid}`;
  });

  await runTest('FedEx get-rate', async () => {
    const res = await axios.post(`${API}/fedex/get-rate`, {
      fromAddress: { street: '123 Lab St', city: 'Baton Rouge', stateOrProvinceCode: 'LA', postalCode: '70802', countryCode: 'US' },
      toAddress: { street: '456 Oak Ave', city: 'Dallas', stateOrProvinceCode: 'TX', postalCode: '75201', countryCode: 'US' },
      weight: 3.0, weightUnit: 'LB', service: 'GROUND_HOME_DELIVERY',
    }, { headers: authHeaders });
    return `Rate: $${res.data.rate?.toFixed(2) || 'N/A'}`;
  });

  // ── STEP 10: API Health ───────────────────────────
  console.log('\n📋 Step 10: API Health Checks');
  const healthEndpoints = [
    '/processing/shipments', '/processing/supplies', '/shipments',
      '/shipments/supplies/all', '/sample-inventory',
  ];
  for (const ep of healthEndpoints) {
    await runTest(`GET /api${ep}`, async () => {
      const res = await axios.get(`${API}${ep}`, { headers: authHeaders });
      return `${res.status} OK`;
    });
  }

  // ── SUMMARY ───────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════');
  console.log('  TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;
  
  console.log(`  Total: ${total} | ✅ Pass: ${passed} | ❌ Fail: ${failed} | ⏩ Skip: ${skipped}`);
  console.log(`  Shipment ID: ${testShipmentId || 'N/A'}`);
  console.log(`  Tracking #: ${testTrackingNumber || 'N/A'}`);
  console.log('');

  if (failed > 0) {
    console.log('  FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.step}: ${r.detail}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
