// Upload existing files to Cloudinary and update database
const { v2: cloudinary } = require('cloudinary');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Cloudinary configuration
cloudinary.config({
  cloud_name: 'dsg5o79p9',
  api_key: '781922545932665',
  api_secret: '4aTLnB4kLGi7cn3awl0wguFubVc'
});

// Production database configuration
const pool = new Pool({
  host: 'dpg-d5elvvq4d50c73c6k8j0-a.oregon-postgres.render.com',
  port: 5432,
  database: 'tlink_db',
  user: 'tlink_user',
  password: 'kr7Tf6WnCuo0txIiwaGy3cEL4Xm3IfYJ',
  ssl: { rejectUnauthorized: false }
});

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function uploadToCloudinary(filePath, folder) {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `tlink/${folder}`,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true
    });
    return result.secure_url;
  } catch (error) {
    console.error(`Error uploading ${filePath}:`, error.message);
    return null;
  }
}

async function processDirectory(dirPath, folderName, updateQuery, getRecordsQuery) {
  if (!fs.existsSync(dirPath)) {
    console.log(`Directory not found: ${dirPath}`);
    return;
  }

  console.log(`\nProcessing ${folderName}...`);
  
  // Get all records that need file updates
  const { rows } = await pool.query(getRecordsQuery);
  console.log(`Found ${rows.length} records`);

  let uploaded = 0;
  let failed = 0;

  for (const record of rows) {
    const fileName = path.basename(record.file_path || record.coa_file_path || record.sds_file_path || '');
    if (!fileName) continue;

    const localPath = path.join(dirPath, fileName);
    
    if (fs.existsSync(localPath)) {
      console.log(`  Uploading ${fileName}...`);
      const cloudinaryUrl = await uploadToCloudinary(localPath, folderName);
      
      if (cloudinaryUrl) {
        // Update database with Cloudinary URL
        await pool.query(updateQuery, [cloudinaryUrl, record.id || record.coa_id || record.sample_id || record.sds_id]);
        console.log(`    ✓ Uploaded and updated database`);
        uploaded++;
      } else {
        failed++;
      }
    } else {
      console.log(`  File not found: ${fileName}`);
      failed++;
    }
  }

  console.log(`${folderName}: ${uploaded} uploaded, ${failed} failed/missing`);
}

async function main() {
  console.log('T-Link: Cloudinary Migration\n=============================\n');

  try {
    // Upload COA PDFs
    await processDirectory(
      path.join(UPLOADS_DIR, 'coa-documents'),
      'coa-documents',
      'UPDATE certificates_of_analysis SET coa_file_path = $1 WHERE coa_id = $2',
      'SELECT coa_id as id, coa_file_path FROM certificates_of_analysis WHERE coa_file_path IS NOT NULL'
    );

    // Upload SDS PDFs
    await processDirectory(
      path.join(UPLOADS_DIR, 'sds-documents'),
      'sds-documents',
      'UPDATE safety_data_sheets SET sds_file_path = $1 WHERE sds_id = $2',
      'SELECT sds_id as id, sds_file_path FROM safety_data_sheets WHERE sds_file_path IS NOT NULL'
    );

    // Upload Sample Documents
    await processDirectory(
      path.join(UPLOADS_DIR, 'sample-documents'),
      'sample-documents',
      'UPDATE sample_inventory SET file_path = $1 WHERE sample_id = $2',
      'SELECT sample_id as id, file_path FROM sample_inventory WHERE file_path IS NOT NULL'
    );

    console.log('\n✓ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Add CLOUDINARY_URL to Render environment variables');
    console.log('2. Push code changes to GitHub');
    console.log('3. Render will auto-deploy');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

main();
