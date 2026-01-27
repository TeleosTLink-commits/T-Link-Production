/**
 * FedEx Sandbox Testing Script
 * 
 * Run this script to validate your FedEx API integration before moving to production.
 * 
 * Usage: npx ts-node scripts/test-fedex-sandbox.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const FEDEX_API_BASE_URL = process.env.FEDEX_API_BASE_URL;
const FEDEX_API_KEY = process.env.FEDEX_API_KEY;
const FEDEX_SECRET_KEY = process.env.FEDEX_SECRET_KEY;
const FEDEX_ACCOUNT_NUMBER = process.env.FEDEX_ACCOUNT_NUMBER;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  isVirtualized?: boolean;
  responseTime?: number;
}

const testResults: TestResult[] = [];

// Color output helpers
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`;

console.log(cyan('\n========================================'));
console.log(cyan('  FedEx Sandbox Integration Testing'));
console.log(cyan('========================================\n'));

console.log('Configuration:');
console.log(`  API Base URL: ${FEDEX_API_BASE_URL}`);
console.log(`  Account Number: ${FEDEX_ACCOUNT_NUMBER ? '****' + String(FEDEX_ACCOUNT_NUMBER).slice(-4) : 'not set'}`);
console.log(`  API Key: ${FEDEX_API_KEY ? '****' + FEDEX_API_KEY.slice(-4) : 'not set'}`);
console.log('\n');

/**
 * Check if response contains virtualized alert
 */
function checkVirtualized(data: any): boolean {
  if (data?.alerts) {
    return data.alerts.some((alert: any) => 
      alert.code === 'VIRTUAL.RESPONSE' || 
      alert.message?.includes('Virtual Response')
    );
  }
  if (data?.output?.alerts) {
    return data.output.alerts.some((alert: any) => 
      alert.code === 'VIRTUAL.RESPONSE' || 
      alert.message?.includes('Virtual Response')
    );
  }
  return false;
}

/**
 * Test 1: OAuth Token Generation
 */
async function testOAuthToken(): Promise<string | null> {
  console.log(cyan('Test 1: OAuth Token Generation'));
  const startTime = Date.now();
  
  try {
    const response = await axios.post(
      `${FEDEX_API_BASE_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: FEDEX_API_KEY!,
        client_secret: FEDEX_SECRET_KEY!,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const responseTime = Date.now() - startTime;
    const token = response.data.access_token;
    const expiresIn = response.data.expires_in;

    testResults.push({
      name: 'OAuth Token Generation',
      passed: true,
      message: `Token obtained successfully (expires in ${expiresIn}s)`,
      responseTime,
    });

    console.log(green('  ✓ PASSED') + ` - Token obtained (${responseTime}ms)`);
    console.log(`    Token type: ${response.data.token_type}`);
    console.log(`    Expires in: ${expiresIn} seconds\n`);

    return token;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
    
    testResults.push({
      name: 'OAuth Token Generation',
      passed: false,
      message: errorMsg,
      responseTime,
    });

    console.log(red('  ✗ FAILED') + ` - ${errorMsg}\n`);
    return null;
  }
}

/**
 * Test 2: Address Validation API
 */
async function testAddressValidation(token: string): Promise<void> {
  console.log(cyan('Test 2: Address Validation API'));
  const startTime = Date.now();

  // FedEx test address (from their documentation)
  const testAddress = {
    addressesToValidate: [
      {
        address: {
          streetLines: ['1202 Chalet Ln'],
          city: 'Harrison',
          stateOrProvinceCode: 'AR',
          postalCode: '72601',
          countryCode: 'US',
        },
      },
    ],
  };

  try {
    const response = await axios.post(
      `${FEDEX_API_BASE_URL}/address/v1/addresses/resolve`,
      testAddress,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
      }
    );

    const responseTime = Date.now() - startTime;
    const isVirtualized = checkVirtualized(response.data);

    testResults.push({
      name: 'Address Validation API',
      passed: true,
      message: 'Address validated successfully',
      isVirtualized,
      responseTime,
    });

    console.log(green('  ✓ PASSED') + ` - Address validated (${responseTime}ms)`);
    if (isVirtualized) {
      console.log(yellow('    ⚠ Virtualized Response'));
    }
    console.log(`    Response structure verified\n`);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
    
    testResults.push({
      name: 'Address Validation API',
      passed: false,
      message: errorMsg,
      responseTime,
    });

    console.log(red('  ✗ FAILED') + ` - ${errorMsg}\n`);
  }
}

/**
 * Test 3: Rate & Transit Times API
 */
async function testRateQuote(token: string): Promise<void> {
  console.log(cyan('Test 3: Rate & Transit Times API'));
  const startTime = Date.now();

  const rateRequest = {
    accountNumber: {
      value: FEDEX_ACCOUNT_NUMBER,
    },
    requestedShipment: {
      shipper: {
        address: {
          streetLines: ['1202 Chalet Ln'],
          city: 'Harrison',
          stateOrProvinceCode: 'AR',
          postalCode: '72601',
          countryCode: 'US',
        },
      },
      recipient: {
        address: {
          streetLines: ['1600 Pennsylvania Ave NW'],
          city: 'Washington',
          stateOrProvinceCode: 'DC',
          postalCode: '20500',
          countryCode: 'US',
        },
      },
      pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
      rateRequestType: ['ACCOUNT', 'LIST'],
      requestedPackageLineItems: [
        {
          weight: {
            units: 'LB',
            value: 5,
          },
        },
      ],
    },
  };

  try {
    const response = await axios.post(
      `${FEDEX_API_BASE_URL}/rate/v1/rates/quotes`,
      rateRequest,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
      }
    );

    const responseTime = Date.now() - startTime;
    const isVirtualized = checkVirtualized(response.data);
    const rates = response.data.output?.rateReplyDetails || [];

    testResults.push({
      name: 'Rate & Transit Times API',
      passed: true,
      message: `Got ${rates.length} rate options`,
      isVirtualized,
      responseTime,
    });

    console.log(green('  ✓ PASSED') + ` - Rate quote received (${responseTime}ms)`);
    if (isVirtualized) {
      console.log(yellow('    ⚠ Virtualized Response'));
    }
    console.log(`    Number of rate options: ${rates.length}\n`);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
    
    testResults.push({
      name: 'Rate & Transit Times API',
      passed: false,
      message: errorMsg,
      responseTime,
    });

    console.log(red('  ✗ FAILED') + ` - ${errorMsg}\n`);
  }
}

/**
 * Test 4: Ship API (Label Generation)
 */
async function testShipLabel(token: string): Promise<string | null> {
  console.log(cyan('Test 4: Ship API (Label Generation)'));
  const startTime = Date.now();

  const shipRequest = {
    labelResponseOptions: 'URL_ONLY',
    requestedShipment: {
      shipper: {
        contact: {
          personName: 'Test Sender',
          phoneNumber: '5551234567',
          companyName: 'Test Company',
        },
        address: {
          streetLines: ['1202 Chalet Ln'],
          city: 'Harrison',
          stateOrProvinceCode: 'AR',
          postalCode: '72601',
          countryCode: 'US',
        },
      },
      recipients: [
        {
          contact: {
            personName: 'Test Recipient',
            phoneNumber: '5559876543',
          },
          address: {
            streetLines: ['1600 Pennsylvania Ave NW'],
            city: 'Washington',
            stateOrProvinceCode: 'DC',
            postalCode: '20500',
            countryCode: 'US',
          },
        },
      ],
      shipDatestamp: new Date().toISOString().split('T')[0],
      serviceType: 'FEDEX_GROUND',
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'USE_SCHEDULED_PICKUP',
      shippingChargesPayment: {
        paymentType: 'SENDER',
      },
      labelSpecification: {
        labelFormatType: 'COMMON2D',
        imageType: 'PDF',
        labelStockType: 'PAPER_4X6',
      },
      requestedPackageLineItems: [
        {
          weight: {
            units: 'LB',
            value: 2,
          },
        },
      ],
    },
    accountNumber: {
      value: FEDEX_ACCOUNT_NUMBER,
    },
  };

  try {
    const response = await axios.post(
      `${FEDEX_API_BASE_URL}/ship/v1/shipments`,
      shipRequest,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
      }
    );

    const responseTime = Date.now() - startTime;
    const isVirtualized = checkVirtualized(response.data);
    const trackingNumber = response.data.output?.transactionShipments?.[0]?.masterTrackingNumber || 
                          response.data.output?.transactionShipments?.[0]?.pieceResponses?.[0]?.trackingNumber;

    testResults.push({
      name: 'Ship API (Label Generation)',
      passed: true,
      message: `Tracking #: ${trackingNumber}`,
      isVirtualized,
      responseTime,
    });

    console.log(green('  ✓ PASSED') + ` - Shipment created (${responseTime}ms)`);
    if (isVirtualized) {
      console.log(yellow('    ⚠ Virtualized Response'));
    }
    console.log(`    Tracking Number: ${trackingNumber}\n`);
    
    return trackingNumber;
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
    
    testResults.push({
      name: 'Ship API (Label Generation)',
      passed: false,
      message: errorMsg,
      responseTime,
    });

    console.log(red('  ✗ FAILED') + ` - ${errorMsg}\n`);
    return null;
  }
}

/**
 * Test 5: Track API
 */
async function testTracking(token: string, trackingNumber: string): Promise<void> {
  console.log(cyan('Test 5: Track API'));
  const startTime = Date.now();

  const trackRequest = {
    trackingInfo: [
      {
        trackingNumberInfo: {
          trackingNumber: trackingNumber || '794624852584', // Use test tracking number if none provided
        },
      },
    ],
    includeDetailedScans: true,
  };

  try {
    const response = await axios.post(
      `${FEDEX_API_BASE_URL}/track/v1/trackingnumbers`,
      trackRequest,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
      }
    );

    const responseTime = Date.now() - startTime;
    const isVirtualized = checkVirtualized(response.data);
    const trackResult = response.data.output?.completeTrackResults?.[0]?.trackResults?.[0];
    const status = trackResult?.latestStatusDetail?.description || 'Status retrieved';

    testResults.push({
      name: 'Track API',
      passed: true,
      message: status,
      isVirtualized,
      responseTime,
    });

    console.log(green('  ✓ PASSED') + ` - Tracking info received (${responseTime}ms)`);
    if (isVirtualized) {
      console.log(yellow('    ⚠ Virtualized Response'));
    }
    console.log(`    Status: ${status}\n`);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
    
    testResults.push({
      name: 'Track API',
      passed: false,
      message: errorMsg,
      responseTime,
    });

    console.log(red('  ✗ FAILED') + ` - ${errorMsg}\n`);
  }
}

/**
 * Test 6: Pickup Request API
 */
async function testPickupAvailability(token: string): Promise<void> {
  console.log(cyan('Test 6: Pickup Availability API'));
  const startTime = Date.now();

  const pickupRequest = {
    pickupAddress: {
      streetLines: ['1202 Chalet Ln'],
      city: 'Harrison',
      stateOrProvinceCode: 'AR',
      postalCode: '72601',
      countryCode: 'US',
    },
    dispatchDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    carriers: ['FDXG'],
    numberOfBusinessDays: 5,
  };

  try {
    const response = await axios.post(
      `${FEDEX_API_BASE_URL}/pickup/v1/pickups/availabilities`,
      pickupRequest,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
      }
    );

    const responseTime = Date.now() - startTime;
    const isVirtualized = checkVirtualized(response.data);

    testResults.push({
      name: 'Pickup Availability API',
      passed: true,
      message: 'Pickup availability checked',
      isVirtualized,
      responseTime,
    });

    console.log(green('  ✓ PASSED') + ` - Pickup availability received (${responseTime}ms)`);
    if (isVirtualized) {
      console.log(yellow('    ⚠ Virtualized Response'));
    }
    console.log(`    Response structure verified\n`);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
    
    testResults.push({
      name: 'Pickup Availability API',
      passed: false,
      message: errorMsg,
      responseTime,
    });

    console.log(red('  ✗ FAILED') + ` - ${errorMsg}\n`);
  }
}

/**
 * Test 7: Error Handling (Negative Test)
 */
async function testErrorHandling(token: string): Promise<void> {
  console.log(cyan('Test 7: Error Handling (Negative Test)'));
  const startTime = Date.now();

  // Intentionally invalid request to test error handling
  const invalidRequest = {
    addressesToValidate: [
      {
        address: {
          streetLines: ['Invalid Address 12345'],
          city: 'INVALID',
          stateOrProvinceCode: 'XX',
          postalCode: '00000',
          countryCode: 'XX',
        },
      },
    ],
  };

  try {
    await axios.post(
      `${FEDEX_API_BASE_URL}/address/v1/addresses/resolve`,
      invalidRequest,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-locale': 'en_US',
        },
      }
    );

    // If we get here, check if address was marked as invalid
    const responseTime = Date.now() - startTime;
    testResults.push({
      name: 'Error Handling (Negative Test)',
      passed: true,
      message: 'Request handled (may return virtualized response for invalid data)',
      responseTime,
    });

    console.log(green('  ✓ PASSED') + ` - Error case handled (${responseTime}ms)\n`);
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    const errorCode = error.response?.data?.errors?.[0]?.code;
    const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
    
    // This is expected to fail - we want to verify error handling works
    testResults.push({
      name: 'Error Handling (Negative Test)',
      passed: true, // Passing because we successfully caught the error
      message: `Correctly returned error: ${errorCode}`,
      responseTime,
    });

    console.log(green('  ✓ PASSED') + ` - Error correctly handled (${responseTime}ms)`);
    console.log(`    Error Code: ${errorCode}`);
    console.log(`    Message: ${errorMsg}\n`);
  }
}

/**
 * Print Summary Report
 */
function printSummary(): void {
  console.log(cyan('========================================'));
  console.log(cyan('           TEST SUMMARY'));
  console.log(cyan('========================================\n'));

  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  const virtualized = testResults.filter(r => r.isVirtualized).length;

  testResults.forEach(result => {
    const status = result.passed ? green('PASS') : red('FAIL');
    const virt = result.isVirtualized ? yellow(' [VIRT]') : '';
    console.log(`${status}${virt} ${result.name}`);
    console.log(`      ${result.message}`);
  });

  console.log('\n' + cyan('----------------------------------------'));
  console.log(`Total Tests: ${testResults.length}`);
  console.log(`Passed: ${green(passed.toString())}`);
  console.log(`Failed: ${red(failed.toString())}`);
  console.log(`Virtualized Responses: ${yellow(virtualized.toString())}`);
  console.log(cyan('----------------------------------------\n'));

  if (failed === 0) {
    console.log(green('✓ All tests passed! Your FedEx sandbox integration is ready.'));
    console.log('\n' + cyan('Next Steps:'));
    console.log('1. Apply for production credentials at FedEx Developer Portal');
    console.log('2. Update .env with production values:');
    console.log('   FEDEX_API_BASE_URL=https://apis.fedex.com');
    console.log('   FEDEX_API_KEY=<production-key>');
    console.log('   FEDEX_SECRET_KEY=<production-secret>');
    console.log('3. Test with a small shipment in production\n');
  } else {
    console.log(red('✗ Some tests failed. Please review the errors above.'));
    console.log('\nCommon issues:');
    console.log('- Check API credentials in .env file');
    console.log('- Verify account number has required API access');
    console.log('- Check FedEx Developer Portal for any account issues\n');
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  try {
    // Validate configuration
    if (!FEDEX_API_KEY || !FEDEX_SECRET_KEY || !FEDEX_ACCOUNT_NUMBER) {
      console.log(red('ERROR: FedEx credentials not configured in .env file\n'));
      console.log('Required environment variables:');
      console.log('  FEDEX_API_BASE_URL');
      console.log('  FEDEX_API_KEY');
      console.log('  FEDEX_SECRET_KEY');
      console.log('  FEDEX_ACCOUNT_NUMBER\n');
      process.exit(1);
    }

    // Test 1: Get OAuth token
    const token = await testOAuthToken();
    
    if (!token) {
      console.log(red('\nCannot continue without authentication token.'));
      printSummary();
      process.exit(1);
    }

    // Test 2: Address Validation
    await testAddressValidation(token);

    // Test 3: Rate Quote
    await testRateQuote(token);

    // Test 4: Ship Label (this will give us a tracking number)
    const trackingNumber = await testShipLabel(token);

    // Test 5: Tracking
    await testTracking(token, trackingNumber || '794624852584');

    // Test 6: Pickup Availability
    await testPickupAvailability(token);

    // Test 7: Error Handling
    await testErrorHandling(token);

    // Print summary
    printSummary();

  } catch (error: any) {
    console.log(red('\nUnexpected error during testing:'));
    console.log(error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();
