const { Pool } = require('pg');
const https = require('https');

const pool = new Pool({
  host: 'localhost',
  database: 'tlink_db',
  user: 'postgres',
  password: 'Ajwa8770',
  port: 5432
});

function testUrl(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => {
      resolve({ url, status: res.statusCode, ok: res.statusCode < 400 });
    });
    req.on('error', (e) => {
      resolve({ url, status: 'error', ok: false, message: e.message });
    });
    req.end();
  });
}

async function main() {
  try {
    console.log('=== Testing Cloudinary File Access ===\n');
    
    // Get all Cloudinary URLs
    const result = await pool.query(`
      SELECT DISTINCT coa_file_path FROM samples WHERE coa_file_path LIKE 'https://%'
      UNION
      SELECT DISTINCT sds_file_path FROM samples WHERE sds_file_path LIKE 'https://%'
      LIMIT 10
    `);
    
    for (const row of result.rows) {
      if (row.coa_file_path) {
        const test = await testUrl(row.coa_file_path);
        console.log(`\nCoA File:`);
        console.log(`  ${test.url.substring(0, 100)}...`);
        console.log(`  Status: ${test.status}`);
        console.log(`  Accessible: ${test.ok ? '✓' : '✗'}`);
      }
      if (row.sds_file_path) {
        const test = await testUrl(row.sds_file_path);
        console.log(`\nSDS File:`);
        console.log(`  ${test.url.substring(0, 100)}...`);
        console.log(`  Status: ${test.status}`);
        console.log(`  Accessible: ${test.ok ? '✓' : '✗'}`);
      }
    }
    
    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
