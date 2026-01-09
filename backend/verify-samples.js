const { Pool } = require('pg');

const pool = new Pool({
  host: 'dpg-d5g3r0qli9vc7398d08g-a.oregon-postgres.render.com',
  port: 5432,
  database: 'tlink_db_zlsw',
  user: 'tlink_user',
  password: 'illvriAUF5XcsXFPFuPeuK8YfQplyCJz',
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN sds_file_path LIKE 'https://res.cloudinary.com%' THEN 1 END) as sds_cloudinary,
    COUNT(CASE WHEN coa_file_path LIKE 'https://res.cloudinary.com%' THEN 1 END) as coa_cloudinary
  FROM samples
`).then(r => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     Production SDS & CoA Status        ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`Total samples: ${r.rows[0].total}`);
  console.log(`SDS on Cloudinary: ${r.rows[0].sds_cloudinary}`);
  console.log(`CoA on Cloudinary: ${r.rows[0].coa_cloudinary}\n`);
  pool.end();
}).catch(e => {
  console.error('Error:', e.message);
  pool.end();
});
