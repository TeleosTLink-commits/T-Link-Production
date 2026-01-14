import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const testDbName = 'tlink_test_db';

export async function setupTestDatabase() {
  // Connect to default postgres database to create test database
  const adminPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres',
    password: process.env.DB_PASSWORD || 'Ajwa8770',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });

  try {
    // Drop existing test database if it exists
    await adminPool.query(`DROP DATABASE IF EXISTS ${testDbName}`);
    console.log(`✓ Dropped existing test database`);

    // Create new test database
    await adminPool.query(`CREATE DATABASE ${testDbName}`);
    console.log(`✓ Created test database: ${testDbName}`);
  } finally {
    await adminPool.end();
  }

  // Connect to test database and run migrations
  const testPool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: testDbName,
    password: process.env.DB_PASSWORD || 'Ajwa8770',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });

  try {
    // Run main schema
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await testPool.query(schema);
    console.log(`✓ Applied main schema`);

    // Run migration 006
    const migrationPath = path.join(__dirname, '../../database/migrations/006_upgrade_manufacturer_portal_schema.sql');
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      await testPool.query(migration);
      console.log(`✓ Applied migration 006`);
    }

    // Seed basic test data
    await seedTestData(testPool);
    console.log(`✓ Seeded test data`);
  } finally {
    await testPool.end();
  }
}

async function seedTestData(pool: Pool) {
  // Create test users
  await pool.query(`
    INSERT INTO users (id, email, password, role, created_at, updated_at)
    VALUES
      ('test-user-1', 'testlab@tlink.local', '$2a$10$salt', 'lab_staff', NOW(), NOW()),
      ('test-user-2', 'testmanuf@tlink.local', '$2a$10$salt', 'manufacturer', NOW(), NOW())
    ON CONFLICT DO NOTHING;
  `);

  // Create test samples
  await pool.query(`
    INSERT INTO samples (id, name, lot_number, available_quantity, unit, created_at, updated_at)
    VALUES
      ('sample-1', 'Sample A', 'LOT-001', 100, 'ml', NOW(), NOW()),
      ('sample-2', 'Sample B', 'LOT-002', 50, 'ml', NOW(), NOW()),
      ('sample-3', 'Sample C', 'LOT-003', 200, 'ml', NOW(), NOW())
    ON CONFLICT DO NOTHING;
  `);

  // Create test manufacturers
  await pool.query(`
    INSERT INTO manufacturers (id, company_name, contact_email, created_at, updated_at)
    VALUES
      ('manuf-1', 'Test Pharma Inc', 'contact@testpharma.com', NOW(), NOW()),
      ('manuf-2', 'Quality Labs Corp', 'info@qualitylabs.com', NOW(), NOW())
    ON CONFLICT DO NOTHING;
  `);
}

export function getTestDatabaseUrl(): string {
  return `postgres://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'Ajwa8770'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${testDbName}`;
}

export function getTestPool(): Pool {
  return new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: testDbName,
    password: process.env.DB_PASSWORD || 'Ajwa8770',
    port: parseInt(process.env.DB_PORT || '5432', 10),
  });
}

// Run setup if executed directly
if (require.main === module) {
  setupTestDatabase()
    .then(() => {
      console.log('✓ Test database setup complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Test database setup failed:', error);
      process.exit(1);
    });
}
