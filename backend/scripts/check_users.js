const { Pool } = require('pg');
const pool = new Pool({
  host: 'dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com',
  database: 'tlink_db_zlsw',
  user: 'tlinkproductiondb_lwjw_user',
  password: 'bOp3VmjfRFiHqMkFh2HcePUljNFJiD4X',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const res = await pool.query(
      "SELECT email, role, created_at FROM authorized_emails WHERE LOWER(email) LIKE '%simpson%' OR LOWER(email) LIKE '%bruzzone%' OR LOWER(email) LIKE '%retusch%' OR LOWER(email) LIKE '%ooijen%' ORDER BY created_at DESC"
    );
    console.log('=== Authorized Emails (international users) ===');
    res.rows.forEach(row => console.log(row.email, '|', row.role, '|', row.created_at));

    const res2 = await pool.query(
      "SELECT email, role, created_at FROM authorized_emails ORDER BY created_at DESC LIMIT 5"
    );
    console.log('\n=== 5 Most Recent Authorized Emails ===');
    res2.rows.forEach(row => console.log(row.email, '|', row.role, '|', row.created_at));

    const res3 = await pool.query(
      "SELECT email, role, is_active, last_login, created_at FROM users WHERE LOWER(email) LIKE '%simpson%' OR LOWER(email) LIKE '%bruzzone%' OR LOWER(email) LIKE '%retusch%' OR LOWER(email) LIKE '%ooijen%'"
    );
    console.log('\n=== Registered Users (international) ===');
    if (res3.rows.length === 0) console.log('(none registered yet)');
    res3.rows.forEach(row => console.log(row.email, '|', row.role, '|', row.is_active, '|', row.last_login, '|', row.created_at));
  } catch (e) {
    console.error(e.message);
  } finally {
    pool.end();
  }
}
check();
