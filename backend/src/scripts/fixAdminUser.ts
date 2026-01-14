import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const EMAIL = 'rxuan@ajwalabs.com';

async function main() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log(`Checking user: ${EMAIL}`);
    let res = await pool.query(
      "SELECT id, email, role, is_active, (password_hash IS NOT NULL) AS has_password FROM users WHERE email=$1",
      [EMAIL]
    );
    console.log('Current users row:', res.rows[0] || null);

    console.log('Upserting into authorized_emails as admin...');
    await pool.query(
      "INSERT INTO authorized_emails (email, role) VALUES ($1,'admin') ON CONFLICT (email) DO UPDATE SET role=EXCLUDED.role",
      [EMAIL]
    );
    res = await pool.query(
      "SELECT email, role FROM authorized_emails WHERE email=$1",
      [EMAIL]
    );
    console.log('Authorized email row:', res.rows[0] || null);

    if (res.rows.length === 0) {
      throw new Error('Failed to upsert authorized_emails');
    }

    console.log('Deleting existing user (if present) to allow fresh registration...');
    const del = await pool.query(
      "DELETE FROM users WHERE email=$1",
      [EMAIL]
    );
    console.log('Delete count:', del.rowCount);

    const final = await pool.query(
      "SELECT id, email FROM users WHERE email=$1",
      [EMAIL]
    );
    console.log('Final users row:', final.rows[0] || null);

    console.log('✅ Completed. User can now register; role will be admin.');
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
