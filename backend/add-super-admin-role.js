const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function addSuperAdminRole() {
  try {
    console.log('📝 Adding super_admin to allowed roles...');
    
    // Drop the old constraint
    await pool.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    `);
    
    // Add new constraint with super_admin included
    await pool.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'lab_staff', 'logistics', 'manufacturer', 'super_admin'));
    `);
    
    console.log('✅ Constraint updated to include super_admin role');
    
    // Now update the user
    const result = await pool.query(
      `UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, first_name, last_name, role`,
      ['super_admin', 'jhunzie@ajwalabs.com']
    );

    if (result.rows.length > 0) {
      console.log('\n✅ User role updated successfully:');
      console.log('-----------------------------------');
      console.log('ID:', result.rows[0].id);
      console.log('Email:', result.rows[0].email);
      console.log('Name:', result.rows[0].first_name, result.rows[0].last_name);
      console.log('New Role:', result.rows[0].role);
      console.log('-----------------------------------');
    } else {
      console.log('\n❌ User not found with email: jhunzie@ajwalabs.com');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

addSuperAdminRole();
