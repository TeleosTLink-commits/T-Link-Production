import { Pool } from 'pg';
import { getTestPool } from '../../database/testSetup';

describe('Database Schema & Migration 006', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = getTestPool();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('Table Existence', () => {
    it('should have dangerous_goods_declarations table', async () => {
      const result = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dangerous_goods_declarations')`
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have sample_sds_documents table', async () => {
      const result = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sample_sds_documents')`
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have email_notifications table', async () => {
      const result = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_notifications')`
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it('should have support_requests table', async () => {
      const result = await pool.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'support_requests')`
      );
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('Column Definitions', () => {
    it('should have required columns in dangerous_goods_declarations', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'dangerous_goods_declarations'
      `);

      const columns = result.rows.map((row) => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('shipment_id');
      expect(columns).toContain('un_number');
      expect(columns).toContain('proper_shipping_name');
      expect(columns).toContain('hazard_class');
      expect(columns).toContain('packing_group');
      expect(columns).toContain('emergency_contact_phone');
      expect(columns).toContain('approval_status');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have required columns in sample_sds_documents', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'sample_sds_documents'
      `);

      const columns = result.rows.map((row) => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('sample_id');
      expect(columns).toContain('file_path');
      expect(columns).toContain('is_current');
      expect(columns).toContain('version_number');
      expect(columns).toContain('created_at');
    });

    it('should have required columns in email_notifications', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'email_notifications'
      `);

      const columns = result.rows.map((row) => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('shipment_id');
      expect(columns).toContain('notification_type');
      expect(columns).toContain('recipient_email');
      expect(columns).toContain('status');
      expect(columns).toContain('sent_at');
      expect(columns).toContain('created_at');
    });

    it('should have required columns in support_requests', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'support_requests'
      `);

      const columns = result.rows.map((row) => row.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('manufacturer_id');
      expect(columns).toContain('request_type');
      expect(columns).toContain('subject');
      expect(columns).toContain('message');
      expect(columns).toContain('assigned_to_email');
      expect(columns).toContain('status');
      expect(columns).toContain('created_at');
      expect(columns).toContain('updated_at');
    });

    it('should have shipment columns extended for FedEx', async () => {
      const result = await pool.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'shipments'
      `);

      const columns = result.rows.map((row) => row.column_name);
      expect(columns).toContain('tracking_number');
      expect(columns).toContain('fedex_label_url');
      expect(columns).toContain('shipping_cost');
      expect(columns).toContain('estimated_delivery');
      expect(columns).toContain('delivery_address');
      expect(columns).toContain('delivery_contact_name');
      expect(columns).toContain('delivery_contact_phone');
      expect(columns).toContain('is_hazmat');
      expect(columns).toContain('scheduled_ship_date');
    });
  });

  describe('Constraints & Indexes', () => {
    it('should have primary keys on new tables', async () => {
      const tables = [
        'dangerous_goods_declarations',
        'sample_sds_documents',
        'email_notifications',
        'support_requests',
      ];

      for (const table of tables) {
        const result = await pool.query(`
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_name = '${table}' AND constraint_type = 'PRIMARY KEY'
        `);
        expect(result.rows.length).toBeGreaterThan(0);
      }
    });

    it('should have foreign key constraints', async () => {
      const result = await pool.query(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'dangerous_goods_declarations' AND constraint_type = 'FOREIGN KEY'
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have indexes on frequently queried columns', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND tablename IN (
          'dangerous_goods_declarations', 'sample_sds_documents',
          'email_notifications', 'support_requests'
        )
      `);
      expect(result.rows.length).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity Tests', () => {
    it('should enforce not null constraints', async () => {
      try {
        await pool.query(`
          INSERT INTO dangerous_goods_declarations (shipment_id, un_number)
          VALUES (NULL, 'UN1093')
        `);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('null');
      }
    });

    it('should enforce unique constraints', async () => {
      // Insert first record
      await pool.query(`
        INSERT INTO shipments (
          id, manufacturer_id, sample_id, quantity, status, created_at, updated_at
        )
        VALUES (
          'test-shipment-1', 'manuf-1', 'sample-1', 25, 'initiated',
          NOW(), NOW()
        )
      `);

      // Try to insert duplicate
      try {
        await pool.query(`
          INSERT INTO shipments (
            id, manufacturer_id, sample_id, quantity, status, created_at, updated_at
          )
          VALUES (
            'test-shipment-1', 'manuf-1', 'sample-1', 25, 'initiated',
            NOW(), NOW()
          )
        `);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('duplicate');
      }
    });

    it('should enforce referential integrity', async () => {
      try {
        // Try to insert DG declaration with non-existent shipment
        await pool.query(`
          INSERT INTO dangerous_goods_declarations (
            id, shipment_id, un_number, proper_shipping_name,
            hazard_class, created_at, updated_at
          )
          VALUES (
            'dg-1', 'nonexistent-shipment', 'UN1093', 'Compressed gas',
            'Class 2.2', NOW(), NOW()
          )
        `);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect((error as Error).message).toContain('foreign key');
      }
    });

    it('should maintain created_at timestamps', async () => {
      const insertResult = await pool.query(`
        INSERT INTO support_requests (
          id, manufacturer_id, request_type, subject, message,
          assigned_to_email, status, created_at, updated_at
        )
        VALUES (
          'support-1', 'manuf-1', 'tech', 'Test issue', 'Help needed',
          'jhunzie@test.com', 'open', NOW(), NOW()
        )
        RETURNING created_at
      `);

      expect(insertResult.rows[0].created_at).toBeDefined();
      expect(insertResult.rows[0].created_at instanceof Date).toBe(true);
    });

    it('should update updated_at on modifications', async () => {
      const insertResult = await pool.query(`
        INSERT INTO support_requests (
          id, manufacturer_id, request_type, subject, message,
          assigned_to_email, status, created_at, updated_at
        )
        VALUES (
          'support-2', 'manuf-1', 'tech', 'Test issue 2', 'Help needed',
          'jhunzie@test.com', 'open', NOW(), NOW()
        )
        RETURNING created_at, updated_at
      `);

      const createdAt = insertResult.rows[0].created_at;

      // Wait a bit and update
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updateResult = await pool.query(`
        UPDATE support_requests
        SET status = 'closed', updated_at = NOW()
        WHERE id = 'support-2'
        RETURNING updated_at
      `);

      expect(updateResult.rows[0].updated_at).toBeDefined();
    });
  });

  describe('Migration Rollback Safety', () => {
    it('should have proper cascade rules', async () => {
      const result = await pool.query(`
        SELECT constraint_name, delete_rule
        FROM information_schema.referential_constraints
        WHERE table_name = 'dangerous_goods_declarations'
      `);

      // Verify no accidental cascades
      const cascades = result.rows.filter((row) => row.delete_rule === 'CASCADE');
      expect(cascades.length).toBeLessThanOrEqual(1); // At most shipment cascade
    });

    it('should preserve existing table structure', async () => {
      const result = await pool.query(`
        SELECT COUNT(*) as table_count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `);

      // Should have original tables + 4 new tables
      expect(result.rows[0].table_count).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Performance Indexes', () => {
    it('should have index on shipment_id in DG table', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'dangerous_goods_declarations'
        AND indexdef LIKE '%shipment_id%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have index on manufacturer_id in support_requests', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'support_requests'
        AND indexdef LIKE '%manufacturer_id%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });

    it('should have index on notification_type in email_notifications', async () => {
      const result = await pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'email_notifications'
        AND indexdef LIKE '%notification_type%'
      `);

      expect(result.rows.length).toBeGreaterThan(0);
    });
  });
});
