/**
 * Production Migration Script for Render
 * Run this on Render to add shipment_samples table
 * 
 * Command to run on Render:
 * node backend/production-migrate-shipments.js
 */

const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting shipment_samples migration...\n');
    
    // Step 1: Check if table already exists
    console.log('Step 1: Checking if shipment_samples table exists...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'shipment_samples'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✓ shipment_samples table already exists\n');
      
      // Verify columns
      const columnCheck = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'shipment_samples'
        ORDER BY ordinal_position;
      `);
      
      console.log('Table columns:');
      columnCheck.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      });
      console.log('');
      
    } else {
      // Step 2: Create the table
      console.log('Step 2: Creating shipment_samples table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS shipment_samples (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
          sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
          quantity_requested DECIMAL(10, 3) NOT NULL,
          unit VARCHAR(20) NOT NULL DEFAULT 'ml',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT unique_shipment_sample UNIQUE(shipment_id, sample_id)
        );
      `);
      console.log('✓ shipment_samples table created\n');
      
      // Step 3: Create indexes
      console.log('Step 3: Creating indexes...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_shipment_samples_shipment_id ON shipment_samples(shipment_id);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_shipment_samples_sample_id ON shipment_samples(sample_id);
      `);
      console.log('✓ Indexes created\n');
    }
    
    // Step 4: Update shipments status constraint
    console.log('Step 4: Updating shipments table status constraint...');
    
    const statusCheck = await client.query(`
      SELECT con.conname, pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'shipments' 
      AND con.contype = 'c'
      AND con.conname LIKE '%status%';
    `);
    
    if (statusCheck.rows.length > 0) {
      const currentDefinition = statusCheck.rows[0].definition;
      console.log('Current constraint:', currentDefinition);
      
      if (!currentDefinition.includes('initiated')) {
        console.log('Adding "initiated" status...');
        
        await client.query(`
          ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
        `);
        
        await client.query(`
          ALTER TABLE shipments ADD CONSTRAINT shipments_status_check 
          CHECK (status IN ('initiated', 'pending', 'processing', 'in_progress', 'shipped', 'in_transit', 'delivered', 'cancelled'));
        `);
        
        console.log('✓ Status constraint updated\n');
      } else {
        console.log('✓ Status constraint already includes "initiated"\n');
      }
    } else {
      console.log('No status constraint found, creating one...');
      await client.query(`
        ALTER TABLE shipments ADD CONSTRAINT shipments_status_check 
        CHECK (status IN ('initiated', 'pending', 'processing', 'in_progress', 'shipped', 'in_transit', 'delivered', 'cancelled'));
      `);
      console.log('✓ Status constraint created\n');
    }
    
    console.log('✅ Migration completed successfully!\n');
    console.log('The shipment_samples table is ready for multi-sample shipments.\n');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    console.error('Full error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
