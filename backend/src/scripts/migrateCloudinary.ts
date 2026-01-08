import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables (expects backend/.env or root .env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnv = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

type RecordRow = { id: string; file_path: string; file_name?: string };

type ProcessConfig = {
  label: string;
  folder: string;
  selectSql: string;
  updateSql: string;
};

async function uploadFile(localPath: string, folder: string): Promise<string | null> {
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      folder: `tlink/${folder}`,
      resource_type: 'auto',
      use_filename: true,
      unique_filename: true,
    });
    return result.secure_url;
  } catch (err: any) {
    console.error(`Upload failed for ${localPath}: ${err.message}`);
    return null;
  }
}

async function processBatch(config: ProcessConfig): Promise<void> {
  console.log(`\n==> ${config.label}`);
  const { rows } = await pool.query<RecordRow>(config.selectSql);
  console.log(`Found ${rows.length} records`);

  let uploaded = 0;
  let skipped = 0;
  let missing = 0;
  let failed = 0;

  for (const row of rows) {
    const filePath = row.file_path;
    if (!filePath) {
      skipped++;
      continue;
    }
    if (filePath.startsWith('http')) {
      skipped++;
      continue;
    }
    const localPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(localPath)) {
      console.warn(`Missing file: ${localPath}`);
      missing++;
      continue;
    }

    const url = await uploadFile(localPath, config.folder);
    if (url) {
      await pool.query(config.updateSql, [url, row.id]);
      uploaded++;
    } else {
      failed++;
    }
  }

  console.log(`${config.label}: uploaded=${uploaded}, skipped=${skipped}, missing=${missing}, failed=${failed}`);
}

async function main(): Promise<void> {
  try {
    await processBatch({
      label: 'Test Methods',
      folder: 'test-methods',
      selectSql: 'SELECT id, file_path, file_name FROM test_methods WHERE file_path IS NOT NULL',
      updateSql: 'UPDATE test_methods SET file_path = $1 WHERE id = $2',
    });

    await processBatch({
      label: 'Sample SDS',
      folder: 'samples/sds',
      selectSql: 'SELECT id, sds_file_path AS file_path, sds_file_name AS file_name FROM samples WHERE sds_file_path IS NOT NULL',
      updateSql: 'UPDATE samples SET sds_file_path = $1 WHERE id = $2',
    });

    await processBatch({
      label: 'Sample CoA',
      folder: 'samples/coa',
      selectSql: 'SELECT id, coa_file_path AS file_path, coa_file_name AS file_name FROM samples WHERE coa_file_path IS NOT NULL',
      updateSql: 'UPDATE samples SET coa_file_path = $1 WHERE id = $2',
    });

    console.log('\nMigration completed.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
