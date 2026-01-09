import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: 'di7yyu1mx',
  api_key: '733869953499621',
  api_secret: 'S4ASfISu4o4Br1r3fchP0SiIko4',
});

// Production database
const prodPool = new Pool({
  host: 'dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com',
  port: 5432,
  database: 'tlink_db_zlsw',
  user: 'tlink_user',
  password: 'illvriAUF5XcsXFPFuPeuK8YfQplyCJz',
  ssl: { rejectUnauthorized: false },
});

// Local database to get file path mappings
const localPool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tlink_db',
  password: 'Ajwa8770',
  port: 5432,
});

async function uploadToCloudinary(
  filePath: string,
  folder: string
): Promise<string | null> {
  try {
    const result = await cloudinary.v2.uploader.upload(filePath, {
      folder: `tlink/${folder}`,
      resource_type: 'auto',
      type: 'upload',
      access_mode: 'public',
      use_filename: true,
      unique_filename: true,
      invalidate: true,
      timeout: 60000,
    });
    return result.secure_url;
  } catch (error: any) {
    console.error(`    ✗ Upload failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Upload Sample SDS & CoA to Cloudinary ║');
  console.log('╚════════════════════════════════════════╝\n');

  const uploadDir = 'C:\\T_Link\\backend\\uploads\\sample-documents';
  
  // Get all PDF files
  const files = fs.readdirSync(uploadDir)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(uploadDir, f));

  console.log(`Found ${files.length} PDF files in uploads directory\n`);

  // Get mapping from local database (which files belong to which samples)
  const localSamples = await localPool.query(`
    SELECT id, chemical_name, sds_file_path, coa_file_path
    FROM samples
    WHERE sds_file_path IS NOT NULL OR coa_file_path IS NOT NULL
  `);

  console.log(`Found ${localSamples.rows.length} samples with file references in local database\n`);

  // Create a map of filename -> {sample_id, field_type}
  const fileMap = new Map<string, {sampleId: string, fieldType: 'sds' | 'coa', chemicalName: string}>();

  for (const sample of localSamples.rows) {
    if (sample.sds_file_path) {
      const filename = path.basename(sample.sds_file_path);
      // Handle both local paths and URLs
      const cleanFilename = filename.replace(/.*\//, '').split('_')[0] + '.pdf';
      fileMap.set(filename, {
        sampleId: sample.id,
        fieldType: 'sds',
        chemicalName: sample.chemical_name,
      });
    }
    if (sample.coa_file_path) {
      const filename = path.basename(sample.coa_file_path);
      const cleanFilename = filename.replace(/.*\//, '').split('_')[0] + '.pdf';
      fileMap.set(filename, {
        sampleId: sample.id,
        fieldType: 'coa',
        chemicalName: sample.chemical_name,
      });
    }
  }

  let sdsUploaded = 0;
  let coaUploaded = 0;
  let failed = 0;

  console.log('=== Uploading Files to Cloudinary ===\n');

  for (const filePath of files) {
    const filename = path.basename(filePath);
    
    // Try to find mapping - first exact match, then try with Cloudinary suffix stripped
    let mapping = fileMap.get(filename);
    
    if (!mapping) {
      // Try to match without Cloudinary suffix (e.g., _abc123.pdf)
      const baseFilename = filename.replace(/_[a-z0-9]+\.pdf$/, '.pdf');
      mapping = fileMap.get(baseFilename);
    }

    if (!mapping) {
      // Extract timestamp from filename and try to find in file map
      const match = filename.match(/file-(\d+)-(\d+)\.pdf/);
      if (match) {
        const timestampPrefix = `file-${match[1]}-${match[2]}`;
        for (const [key, value] of fileMap.entries()) {
          if (key.includes(timestampPrefix)) {
            mapping = value;
            break;
          }
        }
      }
    }

    if (!mapping) {
      console.warn(`  ⚠ No mapping found for ${filename}`);
      continue;
    }

    const folder = mapping.fieldType === 'sds' ? 'samples/sds' : 'samples/coa';
    const fieldName = mapping.fieldType === 'sds' ? 'sds_file_path' : 'coa_file_path';

    console.log(`  Uploading ${mapping.fieldType.toUpperCase()} for ${mapping.chemicalName}...`);
    
    const cloudinaryUrl = await uploadToCloudinary(filePath, folder);

    if (cloudinaryUrl) {
      // Update production database
      try {
        await prodPool.query(
          `UPDATE samples SET ${fieldName} = $1 WHERE id = $2`,
          [cloudinaryUrl, mapping.sampleId]
        );
        console.log(`    ✓ Uploaded and updated: ${cloudinaryUrl.substring(0, 60)}...`);
        
        if (mapping.fieldType === 'sds') {
          sdsUploaded++;
        } else {
          coaUploaded++;
        }
      } catch (error: any) {
        console.error(`    ✗ Database update failed: ${error.message}`);
        failed++;
      }
    } else {
      failed++;
    }
  }

  console.log('\n╔════════════════════════════════════════╗');
  console.log(`║  SDS: ${sdsUploaded} | CoA: ${coaUploaded} | Failed: ${failed}           `);
  console.log('╚════════════════════════════════════════╝\n');

  await localPool.end();
  await prodPool.end();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
