import cloudinary from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'di7yyu1mx',
  api_key: process.env.CLOUDINARY_API_KEY || '733869953499621',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'S4ASfISu4o4Br1r3fchP0SiIko4',
});

const pool = new Pool({
  host: 'dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com',
  port: 5432,
  database: 'tlink_db_zlsw',
  user: 'tlink_user',
  password: 'illvriAUF5XcsXFPFuPeuK8YfQplyCJz',
  ssl: { rejectUnauthorized: false },
});

type FileConfig = {
  label: string;
  folder: string;
  localDir: string;
  selectSql: string;
  updateSql: string;
};

const forceReupload = true; // re-upload even existing Cloudinary URLs to fix access

async function testCloudinaryConnection(): Promise<boolean> {
  try {
    const result = await cloudinary.v2.api.resources({ max_results: 1 });
    console.log('✓ Cloudinary connection successful');
    return true;
  } catch (error: any) {
    console.error('✗ Cloudinary connection failed:', error.message);
    return false;
  }
}

async function uploadFileToCloudinary(
  localPath: string,
  folder: string,
  fileName: string
): Promise<{ url: string; success: boolean; error?: string }> {
  try {
    if (!fs.existsSync(localPath)) {
      return { url: '', success: false, error: `File not found: ${localPath}` };
    }

    const result = await cloudinary.v2.uploader.upload(localPath, {
      folder: `tlink/${folder}`,
      resource_type: 'auto',
      type: 'upload',
      access_mode: 'public',
      use_filename: true,
      unique_filename: true,
      invalidate: true,
      timeout: 60000,
    });

    // Upload successful - Cloudinary SDK confirms it
    console.log(`  ✓ Uploaded: ${fileName} → ${result.secure_url}`);
    return { url: result.secure_url, success: true };
  } catch (error: any) {
    console.error(`  ✗ Upload failed for ${fileName}: ${error.message}`);
    return { url: '', success: false, error: error.message };
  }
}

async function processFileType(config: FileConfig): Promise<void> {
  console.log(`\n=== ${config.label} ===`);

  try {
    // Get records from database
    const result = await pool.query(config.selectSql);
    const records = result.rows;

    console.log(`Found ${records.length} records to process`);

    if (records.length === 0) {
      console.log('No records to process');
      return;
    }

    // Get local files
    let localFiles: string[] = [];
    if (fs.existsSync(config.localDir)) {
      localFiles = fs
        .readdirSync(config.localDir)
        .filter((f) => f.endsWith('.pdf'))
        .map((f) => path.join(config.localDir, f));
    }

    if (localFiles.length === 0) {
      console.warn(`⚠ No local files found in ${config.localDir}`);
      return;
    }

    console.log(`Found ${localFiles.length} local files available`);

    let uploaded = 0;
    let failed = 0;
    let skipped = 0;

    // Process each record
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const fileField = Object.keys(record).find((k) => k.includes('path') && !k.includes('file_name'));

      if (!fileField) continue;

      const currentPath = record[fileField];

      // Skip if already has valid Cloudinary URL
      if (!forceReupload && currentPath && currentPath.startsWith('https://res.cloudinary.com')) {
        console.log(`  ⊘ Skipped (already Cloudinary URL): ${record.id}`);
        skipped++;
        continue;
      }

      // Find matching local file by path
      let localFile: string | undefined;
      
      if (currentPath) {
        // Try to find by exact path
        localFile = localFiles.find(f => f === currentPath);
        
        // If not found, try to find by filename
        if (!localFile) {
          const fileName = path.basename(currentPath);
          localFile = localFiles.find(f => path.basename(f) === fileName);
        }
      }
      
      // Fallback: use index-based matching for unmatched files
      if (!localFile && i < localFiles.length) {
        localFile = localFiles[i];
      }

      if (localFile) {
        const fileName = path.basename(localFile);

        const uploadResult = await uploadFileToCloudinary(localFile, config.folder, fileName);

        if (uploadResult.success) {
          // Update database with the new URL
          try {
            await pool.query(config.updateSql, [uploadResult.url, record.id]);
            console.log(`  ✓ Updated: ${fileName}`);
            uploaded++;
          } catch (dbError: any) {
            console.error(`  ✗ Database update failed for ${record.id}: ${dbError.message}`);
            failed++;
          }
        } else {
          console.error(`  ✗ ${uploadResult.error}`);
          failed++;
        }
      } else {
        console.warn(`  ⚠ No local file available for record ${record.id}`);
        skipped++;
      }
    }

    console.log(
      `\n${config.label} Summary: uploaded=${uploaded}, failed=${failed}, skipped=${skipped}`
    );
  } catch (error: any) {
    console.error(`Error processing ${config.label}:`, error.message);
  }
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  T-Link Production Cloudinary Upload   ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Test Cloudinary connection
  console.log('Testing Cloudinary connection...');
  const connectionOk = await testCloudinaryConnection();

  if (!connectionOk) {
    console.error('\n✗ Cannot proceed without Cloudinary access');
    process.exit(1);
  }

  // Process each file type
  await processFileType({
    label: 'Test Methods',
    folder: 'test-methods',
    localDir: 'C:\\T_Link\\storage\\test-methods',
    selectSql: 'SELECT id, file_path FROM test_methods WHERE file_path IS NOT NULL ORDER BY created_at',
    updateSql: 'UPDATE test_methods SET file_path = $1 WHERE id = $2',
  });

  await processFileType({
    label: 'Sample SDS Files',
    folder: 'samples/sds',
    localDir: 'C:\\T_Link\\storage\\sample-documents',
    selectSql:
      'SELECT id, sds_file_path FROM samples WHERE sds_file_path IS NOT NULL AND sds_file_path NOT LIKE \'https://%\' ORDER BY created_at',
    updateSql: 'UPDATE samples SET sds_file_path = $1 WHERE id = $2',
  });

  await processFileType({
    label: 'Sample CoA Files',
    folder: 'samples/coa',
    localDir: 'C:\\T_Link\\storage\\sample-documents',
    selectSql:
      'SELECT id, coa_file_path FROM samples WHERE coa_file_path IS NOT NULL AND coa_file_path NOT LIKE \'https://%\' ORDER BY created_at',
    updateSql: 'UPDATE samples SET coa_file_path = $1 WHERE id = $2',
  });

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║       Upload Process Complete          ║');
  console.log('╚════════════════════════════════════════╝\n');

  await pool.end();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
