// Fix Cloudinary file access control - make all files public
const { v2: cloudinary } = require('cloudinary');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function makePublic(publicId) {
  try {
    const result = await cloudinary.api.update(publicId, {
      access_control: [{ access_type: 'public' }]
    });
    console.log(`✓ Made public: ${publicId}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to update: ${publicId}`);
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('=== Fixing Cloudinary File Access ===\n');
  
  try {
    // Get all cloudinary files
    const { rows } = await pool.query(`
      SELECT DISTINCT coa_file_path FROM samples WHERE coa_file_path LIKE 'https://%'
      UNION
      SELECT DISTINCT sds_file_path FROM samples WHERE sds_file_path LIKE 'https://%'
    `);
    
    console.log(`Found ${rows.length} unique Cloudinary files\n`);
    
    let fixed = 0;
    for (const row of rows) {
      const filePath = row.coa_file_path || row.sds_file_path;
      
      // Extract public_id from URL
      // URL format: https://res.cloudinary.com/{cloud_name}/{type}/upload/{version}/{public_id}.{ext}
      const match = filePath.match(/\/upload\/v\d+\/(.+?)(?:\.[^.]+)?$/);
      if (match) {
        const publicId = match[1];
        if (await makePublic(publicId)) {
          fixed++;
        }
      }
    }
    
    console.log(`\nFixed ${fixed}/${rows.length} files`);
    console.log('\nAll files should now be publicly accessible!');
    
  } catch (error) {
    console.error('Fatal error:', error.message);
  } finally {
    await pool.end();
  }
}

main();
