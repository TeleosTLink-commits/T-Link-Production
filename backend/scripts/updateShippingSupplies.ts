import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

interface ShippingSupply {
  un_box_type: string;
  inner_packing_type: string;
  dot_sp_number: string;
  item_number: string;
  purchased_from: string;
  price_per_unit: string;
  count: number;
}

async function parseCSV(filePath: string): Promise<ShippingSupply[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const supplies: ShippingSupply[] = [];
  
  for (const line of dataLines) {
    // Parse CSV line (handle commas in quoted strings)
    const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
    
    if (values.length < 7 || !values[0]) continue; // Skip empty or incomplete lines
    
    supplies.push({
      un_box_type: values[0] || '',
      inner_packing_type: values[1] || '',
      dot_sp_number: values[2] || 'NA',
      item_number: values[3] || 'NA',
      purchased_from: values[4] || 'NA',
      price_per_unit: values[5] || 'NA',
      count: parseInt(values[6]) || 0
    });
  }
  
  return supplies;
}

async function updateShippingSupplies() {
  const client = await pool.connect();
  
  try {
    console.log('Starting shipping supplies update...');
    
    // Read CSV file from root directory
    const csvPath = path.join(__dirname, '..', '..', 'Shipping_supplies_inventory.csv');
    console.log(`Reading CSV from: ${csvPath}`);
    
    const supplies = await parseCSV(csvPath);
    console.log(`Found ${supplies.length} supplies in CSV`);
    
    await client.query('BEGIN');
    
    // Clear existing data
    console.log('Clearing existing shipping supplies...');
    await client.query('DELETE FROM shipping_supplies');
    
    // Insert new data
    console.log('Inserting new shipping supplies...');
    for (const supply of supplies) {
      await client.query(
        `INSERT INTO shipping_supplies (un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          supply.un_box_type,
          supply.inner_packing_type,
          supply.dot_sp_number,
          supply.item_number,
          supply.purchased_from,
          supply.price_per_unit,
          supply.count
        ]
      );
      console.log(`  ✓ Added: ${supply.un_box_type} - ${supply.inner_packing_type} (${supply.count} units)`);
    }
    
    await client.query('COMMIT');
    
    console.log('\n✅ Shipping supplies updated successfully!');
    console.log(`Total supplies: ${supplies.length}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating shipping supplies:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the update
updateShippingSupplies()
  .then(() => {
    console.log('Update complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Update failed:', error);
    process.exit(1);
  });
