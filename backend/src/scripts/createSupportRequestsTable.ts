import pool from '../config/database';
import * as fs from 'fs';
import * as path from 'path';

const runMigration = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creating support_requests table...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../../../database/migrations/create_support_requests_table.sql'),
      'utf-8'
    );
    
    await client.query(migrationSQL);
    
    console.log('✅ support_requests table created successfully!');
    
    // Verify the table exists
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'support_requests'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 Table structure:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating support_requests table:', error);
    process.exit(1);
  } finally {
    client.release();
  }
};

runMigration();
