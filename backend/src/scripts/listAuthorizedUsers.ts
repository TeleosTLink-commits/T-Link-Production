import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

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
    console.log('📧 AUTHORIZED EMAILS & ACCOUNT STATUS\n');
    console.log('═'.repeat(80));

    const result = await pool.query(`
      SELECT 
        ae.email,
        ae.role,
        u.id IS NOT NULL AS has_account,
        u.is_active,
        u.last_login,
        u.created_at
      FROM authorized_emails ae
      LEFT JOIN users u ON ae.email = u.email
      ORDER BY ae.email ASC
    `);

    console.log(`\nTotal Authorized: ${result.rows.length}`);
    const withAccount = result.rows.filter(r => r.has_account).length;
    console.log(`With Active Accounts: ${withAccount}\n`);

    console.log('EMAIL'.padEnd(35) + 'ROLE'.padEnd(12) + 'ACCOUNT?'.padEnd(10) + 'LAST LOGIN');
    console.log('─'.repeat(80));

    result.rows.forEach(row => {
      const email = row.email.padEnd(35);
      const role = (row.role || '–').padEnd(12);
      const account = (row.has_account ? '✓ YES' : '✗ NO').padEnd(10);
      const lastLogin = row.last_login 
        ? new Date(row.last_login).toLocaleString() 
        : (row.has_account ? 'Never' : '–');
      
      console.log(email + role + account + lastLogin);
    });

    console.log('\n' + '═'.repeat(80));
    console.log('\n✓ = Account created');
    console.log('✗ = Authorized but no account yet\n');

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
