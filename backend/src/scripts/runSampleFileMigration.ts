import { Pool } from 'pg';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const runMigration = async () => {
  // Use production database config or environment variables
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'tlink_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🔄 Connecting to database...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'tlink_db'}`);

    // Read the migration file
    const migrationPath = path.join(__dirname, '../../../database/migrations/add_coa_sds_file_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Running migration: add_coa_sds_file_columns.sql');
    console.log('---');
    
    // Run the migration
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('\nColumns added:');
    console.log('  - coa_file_path');
    console.log('  - coa_file_name');
    console.log('  - sds_file_path');
    console.log('  - sds_file_name');
    console.log('\nIndexes created on file paths.');

    // Verify the columns were added
    const verifyResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'samples'
      AND column_name IN ('coa_file_path', 'coa_file_name', 'sds_file_path', 'sds_file_name')
      ORDER BY column_name;
    `);

    if (verifyResult.rows.length === 4) {
      console.log('\n✅ Verification successful! All columns exist:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type}(${row.character_maximum_length})`);
      });
    } else {
      console.log('\n⚠️ Warning: Expected 4 columns, found:', verifyResult.rows.length);
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed.');
  }
};

runMigration();
