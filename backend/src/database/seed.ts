import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import { pool } from '../config/database';
import logger from '../config/logger';

const seedPath = path.join(__dirname, '../../../database/seed.sql');

export const runSeeds = async () => {
  try {
    logger.info('Running database seeds...');

    // First, hash the default password
    const defaultPasswordHash = await bcrypt.hash('admin123', 10);

    // Read seed file
    let seedData = fs.readFileSync(seedPath, 'utf-8');

    // Replace placeholder password hash with actual hash
    seedData = seedData.replace(/\$2a\$10\$YourHashedPasswordHere/g, defaultPasswordHash);

    // Execute seed data
    await pool.query(seedData);

    logger.info('Database seeding completed successfully');
    console.log('✅ Database seeded successfully');
    console.log('📝 Default login credentials:');
    console.log('   Admin: admin / admin123');
    console.log('   Lab Staff: lab_user / admin123');
    console.log('   Logistics: logistics_user / admin123');
  } catch (error) {
    logger.error('Seeding failed:', error);
    console.error('❌ Seeding failed:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  runSeeds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
