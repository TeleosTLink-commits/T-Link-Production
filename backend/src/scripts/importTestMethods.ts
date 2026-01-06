import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tlink_db',
  password: process.env.DB_PASSWORD || 'Ajwa8770',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

interface TestMethodCSV {
  'Legacy Number': string;
  'Legacy Lab Source': string;
  'Original Title': string;
  'Method Type': string;
  'Purpose': string;
  'Scope': string;
  'Equipment': string;
  'Reagents': string;
  'Procedure': string;
  'Acceptance Criteria': string;
  'Status': string;
  'Verification Status': string;
  'Notes': string;
}

async function importTestMethods() {
  console.log('🔬 Starting Test Methods Import...\n');

  try {
    // Read the CSV file
    const csvFilePath = path.join(__dirname, '../../test_methods.csv');
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ CSV file not found: ${csvFilePath}`);
      console.log('\n📝 Please create test_methods.csv in the project root with your test method data.');
      console.log('   Use test_methods_template.csv as a reference.\n');
      process.exit(1);
    }

    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const records: TestMethodCSV[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`📊 Found ${records.length} test methods to import\n`);

    // Get admin user ID for created_by
    const adminResult = await pool.query(
      "SELECT id FROM users WHERE username = 'admin' LIMIT 1"
    );
    const adminId = adminResult.rows[0]?.id;

    if (!adminId) {
      console.error('❌ Admin user not found. Please run seed.sql first.');
      process.exit(1);
    }

    // Get category IDs
    const categoryResult = await pool.query('SELECT id, category_name FROM test_method_categories');
    const categories = new Map(
      categoryResult.rows.map((row) => [row.category_name?.toLowerCase() || '', row.id])
    );

    // Determine category from method type
    function getCategoryId(methodType: string): string | null {
      const type = (methodType || '').toLowerCase();
      if (type.includes('gc') || type.includes('gas chromatography')) {
        return categories.get('gas chromatography') || null;
      } else if (type.includes('hplc') || type.includes('lc')) {
        return categories.get('liquid chromatography') || null;
      } else if (type.includes('titration') || type.includes('kf')) {
        return categories.get('titration') || null;
      } else if (type.includes('uv') || type.includes('ir') || type.includes('nmr') || type.includes('ms')) {
        return categories.get('spectroscopy') || null;
      } else {
        return categories.get('other') || null;
      }
    }

    let successCount = 0;
    let errorCount = 0;

    for (const [index, record] of records.entries()) {
      try {
        const categoryId = getCategoryId(record['Method Type']);

        // Insert the test method
        const result = await pool.query(
          `INSERT INTO test_methods (
            legacy_number,
            legacy_lab_source,
            original_title,
            category_id,
            method_type,
            status,
            verification_status,
            purpose,
            scope,
            equipment_required,
            reagents_required,
            procedure,
            acceptance_criteria,
            current_version,
            created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id, legacy_number, original_title`,
          [
            record['Legacy Number'] || null,
            record['Legacy Lab Source'] || null,
            record['Original Title'],
            categoryId,
            record['Method Type'] || null,
            record['Status'] || 'draft',
            record['Verification Status'] || 'pending',
            record['Purpose'] || null,
            record['Scope'] || null,
            record['Equipment'] || null,
            record['Reagents'] || null,
            record['Procedure'] || null,
            record['Acceptance Criteria'] || null,
            '1.0',
            adminId,
          ]
        );

        const testMethodId = result.rows[0].id;

        // Create initial version history entry
        await pool.query(
          `INSERT INTO test_method_versions (
            test_method_id,
            version_number,
            change_type,
            change_description,
            legacy_number,
            title,
            status,
            changed_by,
            new_values
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            testMethodId,
            '1.0',
            'initial_import',
            `Initial import from ${record['Legacy Lab Source'] || 'legacy source'}. ${record['Notes'] || ''}`,
            record['Legacy Number'],
            record['Original Title'],
            record['Status'] || 'draft',
            adminId,
            JSON.stringify({
              legacy_lab_source: record['Legacy Lab Source'],
              method_type: record['Method Type'],
              notes: record['Notes'],
            }),
          ]
        );

        successCount++;
        console.log(
          `✅ [${index + 1}/${records.length}] Imported: ${record['Legacy Number'] || 'NO-NUMBER'} - ${record['Original Title'].substring(0, 50)}...`
        );
      } catch (error: any) {
        errorCount++;
        console.error(
          `❌ [${index + 1}/${records.length}] Failed to import: ${record['Original Title']}`
        );
        console.error(`   Error: ${error.message}\n`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 Import Summary:');
    console.log(`   ✅ Successfully imported: ${successCount} test methods`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📊 Total: ${records.length}`);
    console.log('='.repeat(60) + '\n');

    // Show summary statistics
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN official_number IS NOT NULL THEN 1 END) as standardized,
        COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending_verification,
        COUNT(DISTINCT legacy_lab_source) as lab_sources
      FROM test_methods
    `);

    const stats = statsResult.rows[0];
    console.log('📊 Current Test Methods Library:');
    console.log(`   Total Test Methods: ${stats.total}`);
    console.log(`   Standardized (with official number): ${stats.standardized}`);
    console.log(`   Verified: ${stats.verified}`);
    console.log(`   Pending Verification: ${stats.pending_verification}`);
    console.log(`   Different Lab Sources: ${stats.lab_sources}\n`);

  } catch (error: any) {
    console.error('❌ Fatal error during import:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the import
importTestMethods().catch(console.error);



