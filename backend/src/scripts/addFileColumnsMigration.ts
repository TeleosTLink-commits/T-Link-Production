/**
 * Run this script to add CoA and SDS file columns to production database
 * Usage: ts-node src/scripts/addFileColumnsMigration.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const runMigration = async () => {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔄 Starting migration to add CoA and SDS file columns...');
    console.log(`📍 Database: ${process.env.DB_NAME} at ${process.env.DB_HOST}`);

    await pool.query('BEGIN');

    // Add columns
    console.log('📝 Adding coa_file_path column...');
    await pool.query(`ALTER TABLE samples ADD COLUMN IF NOT EXISTS coa_file_path VARCHAR(500)`);
    
    console.log('📝 Adding coa_file_name column...');
    await pool.query(`ALTER TABLE samples ADD COLUMN IF NOT EXISTS coa_file_name VARCHAR(255)`);
    
    console.log('📝 Adding sds_file_path column...');
    await pool.query(`ALTER TABLE samples ADD COLUMN IF NOT EXISTS sds_file_path VARCHAR(500)`);
    
    console.log('📝 Adding sds_file_name column...');
    await pool.query(`ALTER TABLE samples ADD COLUMN IF NOT EXISTS sds_file_name VARCHAR(255)`);

    // Add indexes
    console.log('🔍 Creating index on coa_file_path...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_samples_coa_file ON samples(coa_file_path) WHERE coa_file_path IS NOT NULL`);
    
    console.log('🔍 Creating index on sds_file_path...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_samples_sds_file ON samples(sds_file_path) WHERE sds_file_path IS NOT NULL`);

    // Verify columns exist
    console.log('✅ Verifying columns were added...');
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'samples' 
      AND column_name IN ('coa_file_path', 'coa_file_name', 'sds_file_path', 'sds_file_name')
      ORDER BY column_name
    `);

    console.log('📊 Columns added:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name} (${row.data_type})`);
    });

    await pool.query('COMMIT');
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
