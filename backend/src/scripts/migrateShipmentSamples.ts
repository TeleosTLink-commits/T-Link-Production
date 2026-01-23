import pool from '../config/database';

async function migrateShipmentSamples() {
  const client = await pool.connect();
  
  try {
    console.log('Checking if shipment_samples table exists...');
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'shipment_samples'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✓ shipment_samples table already exists');
      
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
      
    } else {
      console.log('Creating shipment_samples table...');
      
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
      
      console.log('✓ shipment_samples table created');
      
      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_shipment_samples_shipment_id ON shipment_samples(shipment_id);
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_shipment_samples_sample_id ON shipment_samples(sample_id);
      `);
      
      console.log('✓ Indexes created');
    }
    
    // Check if shipments table has 'initiated' status support
    console.log('\nChecking shipments table status constraint...');
    
    const statusCheck = await client.query(`
      SELECT con.conname, pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'shipments' 
      AND con.contype = 'c'
      AND con.conname LIKE '%status%';
    `);
    
    if (statusCheck.rows.length > 0) {
      console.log('Current status constraint:', statusCheck.rows[0].definition);
      
      // Check if 'initiated' is in the constraint
      if (!statusCheck.rows[0].definition.includes('initiated')) {
        console.log('Adding "initiated" status to shipments...');
        
        await client.query(`
          ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
        `);
        
        await client.query(`
          ALTER TABLE shipments ADD CONSTRAINT shipments_status_check 
          CHECK (status IN ('initiated', 'pending', 'processing', 'shipped', 'in_transit', 'delivered', 'cancelled'));
        `);
        
        console.log('✓ Status constraint updated');
      } else {
        console.log('✓ Status constraint already includes "initiated"');
      }
    }
    
    console.log('\n✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateShipmentSamples()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
