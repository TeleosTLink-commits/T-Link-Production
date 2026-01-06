import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import logger from '../config/logger';

const schemaPath = path.join(__dirname, '../../../database/schema.sql');

export const runMigrations = async () => {
  try {
    logger.info('Running database migrations...');

    // Read schema file
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);

    logger.info('Database migrations completed successfully');
    console.log('✅ Database schema created successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
