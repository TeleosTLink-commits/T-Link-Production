// Verify Cloudinary files and re-upload if necessary
const { v2: cloudinary } = require('cloudinary');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Use environment variables for Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log(`Cloudinary Account: ${process.env.CLOUDINARY_CLOUD_NAME}`);

// Local database configuration (for development)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

async function verifyAndUploadFile(localPath, folder) {
  try {
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(localPath, {
      folder: `tlink/${folder}`,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true
    });
    console.log(`  ✓ Uploaded: ${result.secure_url}`);
    return result.secure_url;
  } catch (error) {
    console.error(`  ✗ Upload failed: ${error.message}`);
    return null;
  }
}

async function verifySampleInventoryFiles() {
  console.log('\n=== Verifying Sample Inventory Files ===');
  
  try {
    const { rows } = await pool.query(`
      SELECT id, coa_file_path, coa_file_name, sds_file_path, sds_file_name 
      FROM samples 
      WHERE (coa_file_path IS NOT NULL OR sds_file_path IS NOT NULL)
      LIMIT 10
    `);

    for (const sample of rows) {
      console.log(`\nSample ID: ${sample.id}`);

      // Check CoA file
      if (sample.coa_file_path) {
        console.log(`  CoA: ${sample.coa_file_path.substring(0, 100)}...`);
        if (sample.coa_file_path.startsWith('http')) {
          console.log('    Already a Cloudinary URL');
        } else {
          const localPath = path.join('C:\\T_Link\\storage\\sample-inventory', sample.coa_file_path);
          if (fs.existsSync(localPath)) {
            console.log(`    Found local file: ${localPath}`);
            const cloudinaryUrl = await verifyAndUploadFile(localPath, 'sample-inventory-coa');
            if (cloudinaryUrl) {
              await pool.query(
                'UPDATE samples SET coa_file_path = $1 WHERE id = $2',
                [cloudinaryUrl, sample.id]
              );
              console.log('    Database updated with Cloudinary URL');
            }
          } else {
            console.log(`    Local file not found: ${localPath}`);
          }
        }
      }

      // Check SDS file
      if (sample.sds_file_path) {
        console.log(`  SDS: ${sample.sds_file_path.substring(0, 100)}...`);
        if (sample.sds_file_path.startsWith('http')) {
          console.log('    Already a Cloudinary URL');
        } else {
          const localPath = path.join('C:\\T_Link\\storage\\sample-inventory', sample.sds_file_path);
          if (fs.existsSync(localPath)) {
            console.log(`    Found local file: ${localPath}`);
            const cloudinaryUrl = await verifyAndUploadFile(localPath, 'sample-inventory-sds');
            if (cloudinaryUrl) {
              await pool.query(
                'UPDATE samples SET sds_file_path = $1 WHERE id = $2',
                [cloudinaryUrl, sample.id]
              );
              console.log('    Database updated with Cloudinary URL');
            }
          } else {
            console.log(`    Local file not found: ${localPath}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error verifying sample inventory:', error);
  }
}

async function verifyTestMethodFiles() {
  console.log('\n=== Verifying Test Method Files ===');
  
  try {
    const { rows } = await pool.query(`
      SELECT id, file_path, file_name 
      FROM test_methods 
      WHERE file_path IS NOT NULL
      LIMIT 10
    `);

    for (const method of rows) {
      console.log(`\nTest Method ID: ${method.id}`);
      console.log(`  File: ${method.file_path.substring(0, 100)}...`);
      
      if (method.file_path.startsWith('http')) {
        console.log('  Already a Cloudinary URL');
      } else {
        const localPath = method.file_path;
        if (fs.existsSync(localPath)) {
          console.log(`  Found local file: ${localPath}`);
          const cloudinaryUrl = await verifyAndUploadFile(localPath, 'test-methods');
          if (cloudinaryUrl) {
            await pool.query(
              'UPDATE test_methods SET file_path = $1 WHERE id = $2',
              [cloudinaryUrl, method.id]
            );
            console.log('  Database updated with Cloudinary URL');
          }
        } else {
          console.log(`  Local file not found: ${localPath}`);
        }
      }
    }
  } catch (error) {
    console.error('Error verifying test methods:', error);
  }
}

async function main() {
  try {
    console.log('Starting Cloudinary verification...');
    await verifySampleInventoryFiles();
    await verifyTestMethodFiles();
    console.log('\n✓ Verification complete');
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
  }
}

main();
