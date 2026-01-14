import { setupTestDatabase } from '../database/testSetup';

beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgres://postgres:Ajwa8770@localhost:5432/tlink_test_db';
  process.env.JWT_SECRET = 'test-secret-key';

  // Setup test database
  await setupTestDatabase();
});

afterAll(async () => {
  // Cleanup handled by jest --forceExit
});
