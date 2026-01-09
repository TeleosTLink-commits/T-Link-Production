const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'tlink_db',
  user: 'postgres',
  password: 'Ajwa8770',
  port: 5432
});

async function check() {
  try {
    console.log('=== Database File Status ===\n');
    
    // Check samples
    const samplesCheck = await pool.query('SELECT COUNT(*) FROM samples');
    console.log('Total samples:', samplesCheck.rows[0].count);
    
    const filesCheck = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE coa_file_path IS NOT NULL) as coa_files,
        COUNT(*) FILTER (WHERE sds_file_path IS NOT NULL) as sds_files
      FROM samples
    `);
    console.log('Samples with CoA files:', filesCheck.rows[0].coa_files);
    console.log('Samples with SDS files:', filesCheck.rows[0].sds_files);
    
    // Get sample of file paths
    const sample = await pool.query(`
      SELECT id, coa_file_path, sds_file_path 
      FROM samples 
      WHERE coa_file_path IS NOT NULL OR sds_file_path IS NOT NULL
      LIMIT 3
    `);
    
    if (sample.rows.length > 0) {
      console.log('\nSample file paths:');
      for (const row of sample.rows) {
        console.log(`  Sample ID: ${row.id}`);
        if (row.coa_file_path) console.log(`    CoA: ${row.coa_file_path}`);
        if (row.sds_file_path) console.log(`    SDS: ${row.sds_file_path}`);
      }
    }
    
    // Check test methods
    const testCheck = await pool.query('SELECT COUNT(*) FROM test_methods');
    console.log('\nTotal test methods:', testCheck.rows[0].count);
    
    const testFilesCheck = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE file_path IS NOT NULL) as with_files FROM test_methods
    `);
    console.log('Test methods with files:', testFilesCheck.rows[0].with_files);
    
    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
}

check();
