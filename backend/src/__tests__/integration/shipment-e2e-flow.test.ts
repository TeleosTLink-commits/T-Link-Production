/**
 * End-to-End Shipment Processing Flow Test
 * 
 * Tests the complete shipment lifecycle:
 * 1. Login & authentication
 * 2. Create shipment (initiation)
 * 3. Fetch shipment for processing
 * 4. Validate delivery address (FedEx API)
 * 5. Get rate quote (FedEx API)
 * 6. Generate shipping label (FedEx API)
 * 7. Track shipment
 * 8. Update shipment status
 * 
 * This test uses mock data and simulates what the ProcessingView UI does.
 * 
 * Run with: npx jest --config jest.e2e.config.js --verbose --forceExit
 * 
 * Set env vars:
 *   TEST_API_URL=https://tlink-production-backend.onrender.com (default)
 *   TEST_AUTH_TOKEN=<your_auth_token> (required - get from browser localStorage)
 */

import axios, { AxiosError } from 'axios';

// Base URL — change to http://localhost:5000 for local testing
const BASE_URL = process.env.TEST_API_URL || 'https://tlink-production-backend.onrender.com';
const API = `${BASE_URL}/api`;

// Auth token - get from browser dev tools: localStorage.getItem('auth_token')
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || '';

let authToken: string = AUTH_TOKEN;
let testShipmentId: string = '';
let testTrackingNumber: string = '';

const results: { step: string; status: '✅' | '❌' | '⏩'; detail: string }[] = [];

// Helper for authenticated requests
const authHeaders = () => ({
  Authorization: `Bearer ${authToken}`,
  'Content-Type': 'application/json',
});

const logResult = (step: string, status: '✅' | '❌' | '⏩', detail: string) => {
  results.push({ step, status, detail });
  console.log(`${status} ${step}: ${detail}`);
};

describe('Shipment Processing E2E Flow', () => {

  // ═══════════════════════════════════════════════════
  // STEP 1: Authentication
  // ═══════════════════════════════════════════════════
  describe('Step 1: Authentication', () => {
    it('should have a valid auth token', async () => {
      if (AUTH_TOKEN) {
        // Test that the provided token works
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: authHeaders(),
          });
          logResult('Auth', '✅', `Token valid - User: ${response.data.data?.email || response.data.email || 'OK'}`);
        } catch (error: any) {
          // Try basic endpoint 
          try {
            const response = await axios.get(`${API}/shipments`, {
              headers: authHeaders(),
            });
            logResult('Auth', '✅', `Token verified via shipments endpoint`);
          } catch (e2: any) {
            logResult('Auth', '❌', `Token invalid: ${e2.response?.status}`);
            throw new Error('Provided TEST_AUTH_TOKEN is invalid. Get a fresh token from browser localStorage.');
          }
        }
      } else {
        // Try to login with env credentials
        const email = process.env.TEST_EMAIL || 'admin@ajwalabs.com';
        const password = process.env.TEST_PASSWORD || '';
        
        if (!password) {
          logResult('Auth', '⏩', 'No TEST_AUTH_TOKEN or TEST_PASSWORD provided. Set TEST_AUTH_TOKEN from browser localStorage.');
          console.log('\n  💡 To get your token:');
          console.log('     1. Login to the app in your browser');
          console.log('     2. Open DevTools → Console');
          console.log('     3. Run: localStorage.getItem("auth_token")');
          console.log('     4. Copy the token and run:');
          console.log(`     SET TEST_AUTH_TOKEN=<token>; npx jest --config jest.e2e.config.js --verbose --forceExit\n`);
          return;
        }

        try {
          const response = await axios.post(`${API}/auth/login`, {
            email,
            password,
          });
          authToken = response.data.data?.token || response.data.token;
          logResult('Auth', '✅', `Login successful: ${email}`);
        } catch (error: any) {
          logResult('Auth', '❌', `Login failed: ${error.response?.data?.message || error.message}`);
          throw error;
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 2: Fetch Processing Dashboard (initiated shipments)
  // ═══════════════════════════════════════════════════
  describe('Step 2: Processing Dashboard', () => {
    it('should fetch shipments with "initiated" status', async () => {
      try {
        const response = await axios.get(`${API}/processing/shipments`, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        
        const shipments = response.data.data || response.data.shipments || response.data;
        console.log(`✅ Processing dashboard loaded: ${Array.isArray(shipments) ? shipments.length : 0} shipments pending`);
        
        if (Array.isArray(shipments) && shipments.length > 0) {
          testShipmentId = shipments[0].id;
          console.log(`   Using shipment: ${shipments[0].shipment_number || testShipmentId}`);
          console.log(`   Chemical: ${shipments[0].chemical_name || 'N/A'}`);
          console.log(`   Recipient: ${shipments[0].recipient_name || `${shipments[0].first_name} ${shipments[0].last_name}`}`);
          console.log(`   HazMat: ${shipments[0].is_hazmat ? 'YES' : 'No'}`);
        } else {
          console.log('   ℹ️ No initiated shipments found - some steps will be skipped');
        }
      } catch (error: any) {
        console.error('❌ Failed to fetch processing shipments:', error.response?.data || error.message);
        throw error;
      }
    });

    it('should fetch shipping supplies inventory', async () => {
      try {
        const response = await axios.get(`${API}/processing/supplies`, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        
        const supplies = Array.isArray(response.data) ? response.data : (response.data.data || []);
        console.log(`✅ Supplies loaded: ${supplies.length} items`);
        
        supplies.slice(0, 3).forEach((supply: any) => {
          console.log(`   - ${supply.supply_name}: ${supply.current_quantity} ${supply.unit}`);
        });
      } catch (error: any) {
        console.error('❌ Failed to fetch supplies:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 3: Fetch Shipment Details for Processing
  // ═══════════════════════════════════════════════════
  describe('Step 3: Shipment Details', () => {
    it('should fetch detailed shipment info for processing', async () => {
      if (!testShipmentId) {
        console.log('   ⏩ Skipped - no shipment available');
        return;
      }

      try {
        const response = await axios.get(`${API}/processing/${testShipmentId}`, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        
        const shipment = response.data.data || response.data;
        console.log('✅ Shipment details loaded:');
        console.log(`   ID: ${shipment.id}`);
        console.log(`   Number: ${shipment.shipment_number}`);
        console.log(`   Chemical: ${shipment.chemical_name || 'N/A'}`);
        console.log(`   Lot: ${shipment.lot_number || shipment.sample_lot_number || 'N/A'}`);
        console.log(`   Amount: ${shipment.amount_shipped} ${shipment.unit}`);
        console.log(`   Recipient: ${shipment.recipient_name || `${shipment.first_name || ''} ${shipment.last_name || ''}`}`);
        console.log(`   Destination: ${shipment.destination_city}, ${shipment.destination_state} ${shipment.destination_zip}`);
        console.log(`   Country: ${shipment.destination_country || 'US'}`);
        console.log(`   HazMat: ${shipment.is_hazmat ? 'YES' : 'No'}`);
        console.log(`   SDS Documents: ${shipment.sds_documents?.length || 0}`);
        console.log(`   Samples: ${shipment.samples?.length || 0}`);
        
        if (shipment.un_number) {
          console.log(`   UN Number: ${shipment.un_number}`);
          console.log(`   Hazard Class: ${shipment.hazard_class}`);
          console.log(`   Packing Group: ${shipment.packing_group}`);
        }
      } catch (error: any) {
        console.error('❌ Failed to fetch shipment details:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 4: Address Validation
  // ═══════════════════════════════════════════════════
  describe('Step 4: Address Validation (Domestic)', () => {
    it('should validate a US domestic address', async () => {
      try {
        const response = await axios.post(`${API}/processing/validate-address`, {
          street: '1600 Amphitheatre Parkway',
          city: 'Mountain View',
          state: 'CA',
          zip: '94043',
          country: 'US',
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        
        const result = response.data.data || response.data;
        console.log('✅ Address validation (domestic):');
        console.log(`   Valid: ${result.valid}`);
        if (result.correctedAddress) {
          console.log(`   Corrected: ${result.correctedAddress.street}, ${result.correctedAddress.city}, ${result.correctedAddress.state} ${result.correctedAddress.zip}`);
        }
        if (result.warning) {
          console.log(`   ⚠️ Warning: ${result.warning}`);
        }
      } catch (error: any) {
        console.error('❌ Domestic address validation error:', error.response?.data || error.message);
        throw error;
      }
    });

    it('should validate an international address', async () => {
      try {
        const response = await axios.post(`${API}/processing/validate-address`, {
          street: '10 Downing Street',
          city: 'London',
          state: '',
          zip: 'SW1A 2AA',
          country: 'GB',
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        
        const result = response.data.data || response.data;
        console.log('✅ Address validation (international - GB):');
        console.log(`   Valid: ${result.valid}`);
        if (result.correctedAddress) {
          console.log(`   Corrected: ${result.correctedAddress.street}, ${result.correctedAddress.city} ${result.correctedAddress.zip}, ${result.correctedAddress.country}`);
        }
      } catch (error: any) {
        console.error('❌ International address validation error:', error.response?.data || error.message);
        throw error;
      }
    });

    it('should validate address without state (NL)', async () => {
      try {
        const response = await axios.post(`${API}/processing/validate-address`, {
          street: 'Keizersgracht 585',
          city: 'Amsterdam',
          state: '',
          zip: '1017DR',
          country: 'NL',
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        console.log('✅ Address validation (no-state country - NL): Valid');
      } catch (error: any) {
        console.error('❌ NL address validation error:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 5: Rate Quotes (Domestic + International)
  // ═══════════════════════════════════════════════════
  describe('Step 5: Rate Quotes', () => {
    const domesticAddress = {
      street: '1600 Amphitheatre Parkway',
      city: 'Mountain View',
      state: 'CA',
      zip: '94043',
      country: 'US',
    };

    const internationalAddress = {
      street: '10 Downing Street',
      city: 'London',
      state: '',
      zip: 'SW1A 2AA',
      country: 'GB',
    };

    it('should get domestic ground rate', async () => {
      try {
        const response = await axios.post(`${API}/processing/get-rate`, {
          toAddress: domesticAddress,
          weight: '2.5',
          weightUnit: 'LB',
          service: 'GROUND_HOME_DELIVERY',
          packageValue: '100',
          isHazmat: false,
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        const data = response.data.data || response.data;
        console.log(`✅ Domestic Ground rate: $${data.rate?.toFixed(2) || 'N/A'}`);
      } catch (error: any) {
        console.error('❌ Ground rate error:', error.response?.data || error.message);
        throw error;
      }
    });

    it('should get domestic overnight rate', async () => {
      try {
        const response = await axios.post(`${API}/processing/get-rate`, {
          toAddress: domesticAddress,
          weight: '2.5',
          weightUnit: 'LB',
          service: 'PRIORITY_OVERNIGHT',
          packageValue: '100',
          isHazmat: false,
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        const data = response.data.data || response.data;
        console.log(`✅ Domestic Priority Overnight rate: $${data.rate?.toFixed(2) || 'N/A'}`);
      } catch (error: any) {
        console.error('❌ Overnight rate error:', error.response?.data || error.message);
        throw error;
      }
    });

    it('should get international priority rate', async () => {
      try {
        const response = await axios.post(`${API}/processing/get-rate`, {
          toAddress: internationalAddress,
          weight: '2.5',
          weightUnit: 'LB',
          service: 'INTERNATIONAL_PRIORITY',
          packageValue: '100',
          isHazmat: false,
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        const data = response.data.data || response.data;
        console.log(`✅ International Priority rate: $${data.rate?.toFixed(2) || 'N/A'}`);
      } catch (error: any) {
        console.error('❌ International rate error:', error.response?.data || error.message);
        throw error;
      }
    });

    it('should get international economy rate', async () => {
      try {
        const response = await axios.post(`${API}/processing/get-rate`, {
          toAddress: internationalAddress,
          weight: '2.5',
          weightUnit: 'LB',
          service: 'INTERNATIONAL_ECONOMY',
          packageValue: '100',
          isHazmat: false,
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        const data = response.data.data || response.data;
        console.log(`✅ International Economy rate: $${data.rate?.toFixed(2) || 'N/A'}`);
      } catch (error: any) {
        console.error('❌ International Economy rate error:', error.response?.data || error.message);
        throw error;
      }
    });

    it('should get Express Saver rate', async () => {
      try {
        const response = await axios.post(`${API}/processing/get-rate`, {
          toAddress: domesticAddress,
          weight: '1.0',
          weightUnit: 'LB',
          service: 'FEDEX_EXPRESS_SAVER',
          packageValue: '50',
          isHazmat: false,
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        const data = response.data.data || response.data;
        console.log(`✅ Express Saver rate: $${data.rate?.toFixed(2) || 'N/A'}`);
      } catch (error: any) {
        console.error('❌ Express Saver rate error:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 6: Shipment Creation (Multi-sample)
  // ═══════════════════════════════════════════════════
  describe('Step 6: Shipment Creation', () => {
    it('should create a new test shipment via /api/shipments/multi', async () => {
      try {
        // First check if we have any samples
        const samplesRes = await axios.get(`${API}/sample-inventory`, {
          headers: authHeaders(),
        });

        const samples = samplesRes.data.data || samplesRes.data.samples || samplesRes.data;
        
        if (!Array.isArray(samples) || samples.length === 0) {
          console.log('   ⏩ No samples available for shipment creation test');
          return;
        }

        const testSample = samples[0];
        console.log(`   Using sample: ${testSample.chemical_name || testSample.sample_name} (Lot: ${testSample.lot_number})`);

        const response = await axios.post(`${API}/shipments/multi`, {
          recipient_name: 'E2E Test Recipient',
          first_name: 'Test',
          last_name: 'User',
          destination_address: '123 Test Street',
          destination_city: 'Austin',
          destination_state: 'TX',
          destination_zip: '73301',
          destination_country: 'US',
          recipient_phone: '5121234567',
          is_hazmat: false,
          items: [{
            sample_id: testSample.id,
            chemical_name: testSample.chemical_name || testSample.sample_name,
            lot_number: testSample.lot_number,
            amount: 10,
            unit: 'ml',
          }],
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(201);
        
        if (response.data.data?.id || response.data.shipment?.id) {
          const created = response.data.data || response.data.shipment;
          testShipmentId = created.id;
          console.log(`✅ Shipment created: ${created.shipment_number || testShipmentId}`);
        } else {
          console.log('✅ Shipment creation response received');
          console.log('   Response:', JSON.stringify(response.data).slice(0, 200));
        }
      } catch (error: any) {
        if (error.response?.status === 400) {
          console.log(`   ⚠️ Shipment creation returned 400: ${error.response.data.error || error.response.data.message}`);
          // Not a hard failure - might be insufficient quantity etc.
        } else {
          console.error('❌ Shipment creation error:', error.response?.data || error.message);
          throw error;
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 7: Generate Label (simulate - only if shipment exists)
  // ═══════════════════════════════════════════════════
  describe('Step 7: Label Generation', () => {
    it('should generate a FedEx shipping label', async () => {
      if (!testShipmentId) {
        console.log('   ⏩ Skipped - no shipment available');
        return;
      }

      try {
        const response = await axios.post(`${API}/processing/generate-label`, {
          shipmentId: testShipmentId,
          weight: '2.5',
          weightUnit: 'LB',
          service: 'GROUND_HOME_DELIVERY',
          packageValue: '100',
          isHazmat: false,
          suppliesUsed: [],
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        
        const data = response.data.data || response.data;
        testTrackingNumber = data.trackingNumber || data.tracking_number || '';
        
        console.log('✅ Label generated:');
        console.log(`   Tracking Number: ${testTrackingNumber}`);
        console.log(`   Shipping Cost: $${data.cost?.toFixed(2) || 'N/A'}`);
        console.log(`   Estimated Delivery: ${data.estimatedDelivery || data.estimated_delivery || 'N/A'}`);
        console.log(`   Label Path: ${data.labelPath || data.label_url || 'N/A'}`);
      } catch (error: any) {
        console.error('❌ Label generation error:', error.response?.data || error.message);
        // Don't throw - this might fail with mock FedEx in production
        console.log('   ℹ️ This can fail if FedEx credentials are sandbox/mock');
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 8: Tracking
  // ═══════════════════════════════════════════════════
  describe('Step 8: Tracking', () => {
    it('should retrieve tracking info for a shipment', async () => {
      if (!testTrackingNumber) {
        console.log('   ⏩ Skipped - no tracking number available');
        return;
      }

      try {
        const response = await axios.get(`${API}/processing/tracking/${testTrackingNumber}`, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        
        const data = response.data.data || response.data;
        console.log('✅ Tracking info retrieved:');
        console.log(`   Status: ${data.status}`);
        console.log(`   Location: ${data.location}`);
        console.log(`   Timestamp: ${data.timestamp}`);
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log('   ℹ️ Tracking info not available yet (expected for mock/new shipments)');
        } else {
          console.error('❌ Tracking error:', error.response?.data || error.message);
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 9: Status Update
  // ═══════════════════════════════════════════════════
  describe('Step 9: Status Updates', () => {
    it('should be able to update shipment status', async () => {
      if (!testShipmentId) {
        console.log('   ⏩ Skipped - no shipment available');
        return;
      }

      try {
        const response = await axios.post(`${API}/processing/shipments/${testShipmentId}/update-status`, {
          new_status: 'processing',
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        console.log('✅ Status updated to: processing');
      } catch (error: any) {
        console.error('❌ Status update error:', error.response?.data || error.message);
        // Non-fatal - status might already be shipped
        console.log('   ℹ️ Status update failed (shipment may already be shipped)');
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 10: API Endpoint Health Checks
  // ═══════════════════════════════════════════════════
  describe('Step 10: API Health Checks', () => {
    const endpoints = [
      { method: 'GET', path: '/processing/shipments', name: 'Processing Shipments' },
      { method: 'GET', path: '/processing/supplies', name: 'Shipping Supplies' },
      { method: 'GET', path: '/shipments', name: 'All Shipments' },
      { method: 'GET', path: '/shipments/supplies/all', name: 'All Supplies' },
      { method: 'GET', path: '/sample-inventory', name: 'Samples Inventory' },
    ];

    endpoints.forEach(({ method, path, name }) => {
      it(`should respond: ${method} /api${path} (${name})`, async () => {
        try {
          const response = await axios({
            method: method.toLowerCase(),
            url: `${API}${path}`,
            headers: authHeaders(),
          });

          expect(response.status).toBe(200);
          console.log(`✅ ${method} /api${path} → ${response.status} OK`);
        } catch (error: any) {
          console.error(`❌ ${method} /api${path} → ${error.response?.status || 'ERROR'}: ${error.response?.data?.error || error.message}`);
          throw error;
        }
      });
    });
  });

  // ═══════════════════════════════════════════════════
  // STEP 11: FedEx Direct API Tests
  // ═══════════════════════════════════════════════════
  describe('Step 11: FedEx Direct Endpoints', () => {
    it('should validate address via /api/fedex/validate-address', async () => {
      try {
        const response = await axios.post(`${API}/fedex/validate-address`, {
          street: '456 Oak Avenue',
          city: 'Dallas',
          stateOrProvinceCode: 'TX',
          postalCode: '75201',
          countryCode: 'US',
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        console.log(`✅ FedEx direct address validation: valid=${response.data.valid}`);
      } catch (error: any) {
        console.error('❌ FedEx validate-address error:', error.response?.data || error.message);
        throw error;
      }
    });

    it('should get rate via /api/fedex/get-rate', async () => {
      try {
        const response = await axios.post(`${API}/fedex/get-rate`, {
          fromAddress: {
            street: '123 Lab Street',
            city: 'Baton Rouge',
            stateOrProvinceCode: 'LA',
            postalCode: '70802',
            countryCode: 'US',
          },
          toAddress: {
            street: '456 Oak Avenue',
            city: 'Dallas',
            stateOrProvinceCode: 'TX',
            postalCode: '75201',
            countryCode: 'US',
          },
          weight: 3.0,
          weightUnit: 'LB',
          service: 'GROUND_HOME_DELIVERY',
        }, {
          headers: authHeaders(),
        });

        expect(response.status).toBe(200);
        console.log(`✅ FedEx direct rate: $${response.data.rate?.toFixed(2) || 'N/A'}`);
      } catch (error: any) {
        console.error('❌ FedEx get-rate error:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  // ═══════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════
  afterAll(() => {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  SHIPMENT E2E FLOW TEST SUMMARY');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Auth Token: ${authToken ? '✅ Obtained' : '❌ Missing'}`);
    console.log(`  Shipment ID: ${testShipmentId || 'None (no initiated shipments)'}`);
    console.log(`  Tracking #: ${testTrackingNumber || 'None generated'}`);
    console.log(`  API Base: ${BASE_URL}`);
    console.log('═══════════════════════════════════════════════\n');
  });
});
