import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

interface SampleRecord {
  'Chemical Name': string;
  'Received': string;
  'Lot Number': string;
  'Quantity': string;
  'Concentration': string;
  'DOW SDS': string;
  'CAS Number': string;
  'Have CoA': string;
  'Certification Date': string;
  'Recertification Date': string;
  'Expiration Date': string;
  'UN Number': string;
  'Hazard': string;
  'HS Code': string;
  'Hazard Class': string;
  'Packing Group': string;
  'Packing Inst.': string;
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === '' || dateStr === '?') {
    return null;
  }

  try {
    // Handle various date formats
    // "10/21/2025" -> "2025-10-21"
    // "10-Oct-24" -> "2024-10-10"
    // "September, 2026" -> "2026-09-01"
    
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    if (dateStr.includes('-') && dateStr.includes('-', dateStr.indexOf('-') + 1)) {
      // Format: "10-Oct-24"
      const [day, monthStr, year] = dateStr.split('-');
      const monthMap: { [key: string]: string } = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      const month = monthMap[monthStr];
      const fullYear = year.length === 2 ? `20${year}` : year;
      return `${fullYear}-${month}-${day.padStart(2, '0')}`;
    }
    
    if (dateStr.toLowerCase().includes('september')) {
      return '2026-09-01';
    }
    
    return null;
  } catch (error) {
    console.warn(`Could not parse date: ${dateStr}`);
    return null;
  }
}

async function importSampleInventory(csvFilePath: string) {
  try {
    console.log('📂 Reading CSV file...');
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as SampleRecord[];

    console.log(`📊 Found ${records.length} records to import`);

    // Get admin user for created_by field
    const adminResult = await pool.query(
      "SELECT id FROM users WHERE username = 'admin' LIMIT 1"
    );
    const createdBy = adminResult.rows[0]?.id;

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const record of records) {
      try {
        // Skip header row if it exists
        if (record['Chemical Name'] === 'Chemical Name') {
          continue;
        }

        const chemicalName = record['Chemical Name']?.trim();
        
        // Skip empty rows
        if (!chemicalName || chemicalName === '') {
          skipped++;
          continue;
        }

        const receivedDate = parseDate(record['Received']);
        const certificationDate = parseDate(record['Certification Date']);
        const recertificationDate = parseDate(record['Recertification Date']);
        const expirationDate = parseDate(record['Expiration Date']);

        await pool.query(`
          INSERT INTO samples (
            chemical_name,
            received_date,
            lot_number,
            quantity,
            concentration,
            has_dow_sds,
            cas_number,
            has_coa,
            certification_date,
            recertification_date,
            expiration_date,
            un_number,
            hazard_description,
            hs_code,
            hazard_class,
            packing_group,
            packing_instruction,
            created_by,
            status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        `, [
          chemicalName,
          receivedDate,
          record['Lot Number'] || null,
          record['Quantity'] || null,
          record['Concentration'] || null,
          record['DOW SDS']?.toUpperCase() === 'Y',
          record['CAS Number'] || null,
          record['Have CoA']?.toUpperCase() === 'Y',
          certificationDate,
          recertificationDate,
          expirationDate,
          record['UN Number'] || null,
          record['Hazard'] || null,
          record['HS Code'] || null,
          record['Hazard Class'] || null,
          record['Packing Group'] || null,
          record['Packing Inst.'] || null,
          createdBy,
          expirationDate && new Date(expirationDate) < new Date() ? 'expired' : 'active'
        ]);

        imported++;
        if (imported % 10 === 0) {
          console.log(`  ✓ Imported ${imported} samples...`);
        }
      } catch (error: any) {
        errors++;
        console.error(`  ❌ Error importing sample "${record['Chemical Name']}":`, error.message);
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`  ✅ Imported: ${imported}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);

    // Show statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE + INTERVAL '30 days' 
                        AND expiration_date >= CURRENT_DATE) as expiring_soon
      FROM samples
    `);

    console.log('\n📈 Database Statistics:');
    console.log(`  Total Samples: ${stats.rows[0].total}`);
    console.log(`  Active: ${stats.rows[0].active}`);
    console.log(`  Expired: ${stats.rows[0].expired}`);
    console.log(`  Expiring Soon (30 days): ${stats.rows[0].expiring_soon}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run import
const csvPath = process.argv[2] || 'c:/T_Link/Sample inventory.csv';
console.log(`\n🚀 Starting Sample Inventory Import from: ${csvPath}\n`);

importSampleInventory(csvPath)
  .then(() => {
    console.log('\n✅ Sample inventory import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  });
