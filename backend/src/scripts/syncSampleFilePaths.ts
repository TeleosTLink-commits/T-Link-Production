import { Pool } from 'pg';

// Local database connection
const localPool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'tlink_db',
  password: 'Ajwa8770',
  port: 5432,
});

// Production database connection
const prodPool = new Pool({
  host: 'dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com',
  port: 5432,
  database: 'tlink_db_zlsw',
  user: 'tlink_user',
  password: 'illvriAUF5XcsXFPFuPeuK8YfQplyCJz',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Sync Sample File Paths to Production ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Get all samples from local database with file paths
    const localSamples = await localPool.query(`
      SELECT id, chemical_name, sds_file_path, coa_file_path 
      FROM samples 
      WHERE sds_file_path IS NOT NULL OR coa_file_path IS NOT NULL
    `);

    console.log(`Found ${localSamples.rows.length} samples with file paths in local database\n`);

    let updatedSDS = 0;
    let updatedCoA = 0;
    let skipped = 0;
    let failed = 0;

    for (const sample of localSamples.rows) {
      try {
        // Check if sample exists in production
        const prodCheck = await prodPool.query('SELECT id FROM samples WHERE id = $1', [sample.id]);
        
        if (prodCheck.rows.length === 0) {
          console.warn(`  ⚠ Sample ${sample.chemical_name} (${sample.id}) not found in production`);
          skipped++;
          continue;
        }

        // Update production database with file paths
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (sample.sds_file_path) {
          // Convert Cloudinary URLs to local paths since files don't exist on Cloudinary
          if (sample.sds_file_path.startsWith('https://')) {
            // Skip Cloudinary URLs - we'll upload fresh files
            console.log(`  ⊘ Skipping old Cloudinary URL for ${sample.chemical_name} (SDS)`);
            skipped++;
            continue;
          }
          updates.push(`sds_file_path = $${paramIndex++}`);
          values.push(sample.sds_file_path);
          updatedSDS++;
        }

        if (sample.coa_file_path) {
          if (sample.coa_file_path.startsWith('https://')) {
            console.log(`  ⊘ Skipping old Cloudinary URL for ${sample.chemical_name} (CoA)`);
            skipped++;
            continue;
          }
          updates.push(`coa_file_path = $${paramIndex++}`);
          values.push(sample.coa_file_path);
          updatedCoA++;
        }

        if (updates.length > 0) {
          values.push(sample.id);
          await prodPool.query(
            `UPDATE samples SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            values
          );
          console.log(`  ✓ Updated ${sample.chemical_name}`);
        }
      } catch (error: any) {
        console.error(`  ✗ Failed to update ${sample.chemical_name}: ${error.message}`);
        failed++;
      }
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log(`║  SDS: ${updatedSDS} | CoA: ${updatedCoA} | Skipped: ${skipped} | Failed: ${failed}  `);
    console.log('╚════════════════════════════════════════╝\n');

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await localPool.end();
    await prodPool.end();
  }
}

main();
