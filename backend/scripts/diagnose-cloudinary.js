// Diagnostic script to check Cloudinary configuration and file access
const { v2: cloudinary } = require('cloudinary');
const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configure with environment variables
const config = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

console.log('=== Cloudinary Configuration ===');
console.log(`Cloud Name: ${config.cloud_name}`);
console.log(`API Key: ${config.api_key ? config.api_key.substring(0, 5) + '...' : 'NOT SET'}`);
console.log(`API Secret: ${config.api_secret ? config.api_secret.substring(0, 5) + '...' : 'NOT SET'}`);

cloudinary.config(config);

// Test Cloudinary connectivity
async function testCloudinaryConnection() {
  console.log('\n=== Testing Cloudinary Connection ===');
  try {
    // Try to get account info
    const result = await cloudinary.api.resources({ max_results: 1 });
    console.log('✓ Connected to Cloudinary successfully');
    console.log(`  Total resources: ${result.total_count || 0}`);
    
    // List some recent files
    if (result.resources && result.resources.length > 0) {
      console.log('\nRecent files:');
      for (const resource of result.resources.slice(0, 5)) {
        console.log(`  - ${resource.public_id}`);
        console.log(`    URL: ${resource.secure_url}`);
        console.log(`    Type: ${resource.type} (${resource.resource_type})`);
      }
    }
  } catch (error) {
    console.error('✗ Failed to connect:', error.message);
    if (error.message.includes('Authentication')) {
      console.error('  → Check your CLOUDINARY_CLOUD_NAME and API credentials');
    }
  }
}

// Test URL accessibility
function testUrlAccess(url) {
  return new Promise((resolve) => {
    console.log(`\nTesting URL: ${url}`);
    https.get(url, (res) => {
      console.log(`  Status: ${res.statusCode}`);
      console.log(`  Content-Type: ${res.headers['content-type']}`);
      console.log(`  Content-Length: ${res.headers['content-length'] || 'unknown'}`);
      
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('  ✓ URL is accessible');
      } else if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log(`  → Redirect to: ${res.headers['location']}`);
      } else {
        console.log(`  ✗ Error: ${res.statusCode}`);
      }
      resolve();
    }).on('error', (error) => {
      console.error(`  ✗ Connection error: ${error.message}`);
      resolve();
    });
  });
}

async function main() {
  await testCloudinaryConnection();
  
  // Test the file from your error message if it exists
  const testUrls = [
    'https://res.cloudinary.com/di7yyu1mx/image/upload/v1/tlink/sample-inventory-coa/file-1767654110589-937603278_gkowo7.pdf',
    'https://res.cloudinary.com/di7yyu1mx/raw/upload/v1/tlink/sample-inventory-coa/file-1767654110589-937603278_gkowo7.pdf'
  ];
  
  console.log('\n=== Testing Sample File URLs ===');
  for (const url of testUrls) {
    await testUrlAccess(url);
  }
  
  console.log('\n✓ Diagnostic complete');
}

main();
