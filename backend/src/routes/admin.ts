import { Router } from 'express';
import { pool } from '../config/database';
import bcrypt from 'bcrypt';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendRegistrationInvitation } from '../services/emailService';

const router = Router();

// Middleware to check super admin role
const checkSuperAdmin = (req: AuthRequest, res: any, next: any) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ 
      error: 'Access Denied',
      message: 'Super Admin privileges required' 
    });
  }
  next();
};

// Apply auth middleware to all routes
router.use(authenticate);
router.use(checkSuperAdmin);

// Verify super admin access
router.get('/verify', (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ 
    success: true, 
    isSuperAdmin: req.user.role === 'super_admin',
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        email, 
        first_name, 
        last_name, 
        role, 
        is_active, 
        created_at, 
        last_login
      FROM users
      ORDER BY created_at DESC
    `);
    
    res.json({ 
      success: true, 
      data: result.rows 
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      details: error.message 
    });
  }
});

// Create new user
router.post('/users', async (req, res) => {
  try {
    const { email, role } = req.body;

    // Validate required fields
    if (!email || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['email', 'role']
      });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Validate role
    const validRoles = ['manufacturer', 'lab_staff', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        validRoles 
      });
    }

    // Check if email already exists in users table (case-insensitive)
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Email already exists as a registered user' 
      });
    }

    // Check if email already in authorized_emails (case-insensitive)
    const existingAuthorized = await pool.query(
      'SELECT id FROM authorized_emails WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingAuthorized.rows.length > 0) {
      // Update existing authorized email with new role
      await pool.query(
        'UPDATE authorized_emails SET role = $1 WHERE LOWER(email) = $2',
        [role, normalizedEmail]
      );
      return res.json({ 
        success: true, 
        message: 'User authorization updated. They can now register with this role.',
        data: { email: normalizedEmail, role } 
      });
    }

    // Add to authorized_emails table with normalized email
    await pool.query(`
      INSERT INTO authorized_emails (email, role)
      VALUES ($1, $2)
    `, [normalizedEmail, role]);

    // Send email invitation with registration link
    let emailSent = false;
    try {
      emailSent = await sendRegistrationInvitation(normalizedEmail, role);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Don't fail the whole operation if email fails
    }

    res.json({ 
      success: true, 
      message: emailSent 
        ? 'User authorized successfully. An invitation email has been sent.'
        : 'User authorized successfully. They can now register at the portal. (Email notification could not be sent)',
      data: { email: normalizedEmail, role, emailSent }
    });
  } catch (error: any) {
    console.error('Error authorizing user:', error);
    res.status(500).json({ 
      error: 'Failed to authorize user',
      details: error.message 
    });
  }
});

// Reset user password
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'UPDATE users SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL WHERE id = $2 RETURNING id, email',
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'Password reset successfully',
      user: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    res.status(500).json({ 
      error: 'Failed to reset password',
      details: error.message 
    });
  }
});

// Change user role
router.post('/users/:id/change-role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['manufacturer', 'lab_staff', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role',
        validRoles 
      });
    }

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'Role updated successfully',
      user: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error changing role:', error);
    res.status(500).json({ 
      error: 'Failed to change role',
      details: error.message 
    });
  }
});

// Toggle user active status
router.post('/users/:id/toggle-status', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const result = await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, email, is_active',
      [isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ 
      error: 'Failed to toggle user status',
      details: error.message 
    });
  }
});

// Permanently delete user (super_admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if user exists
    const userCheck = await pool.query('SELECT email, role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userToDelete = userCheck.rows[0];
    
    // Prevent deleting super_admin users as safety measure
    if (userToDelete.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super admin users' });
    }
    
    // Delete related records first (foreign key constraints)
    // Delete from manufacturer_users if exists
    await pool.query('DELETE FROM manufacturer_users WHERE user_id = $1', [id]);
    
    // Delete the user
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    // Optionally remove from authorized_emails so they can't re-register
    await pool.query('DELETE FROM authorized_emails WHERE LOWER(email) = LOWER($1)', [userToDelete.email]);
    
    res.json({ 
      success: true, 
      message: `User ${userToDelete.email} permanently deleted`
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      error: 'Failed to delete user',
      details: error.message 
    });
  }
});

// Delete shipment
router.delete('/shipments/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Delete related records first
    await client.query('DELETE FROM shipment_supplies_used WHERE shipment_id = $1', [id]);
    await client.query('DELETE FROM shipment_samples WHERE shipment_id = $1', [id]);
    
    // Delete the shipment
    const result = await client.query(
      'DELETE FROM shipments WHERE id = $1 RETURNING shipment_number',
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Shipment not found' });
    }

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Shipment deleted successfully',
      shipmentNumber: result.rows[0].shipment_number
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error deleting shipment:', error);
    res.status(500).json({ 
      error: 'Failed to delete shipment',
      details: error.message 
    });
  } finally {
    client.release();
  }
});

// Delete sample
router.delete('/samples/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM samples WHERE id = $1 RETURNING chemical_name, lot_number',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    res.json({ 
      success: true, 
      message: 'Sample deleted successfully',
      sample: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error deleting sample:', error);
    res.status(500).json({ 
      error: 'Failed to delete sample',
      details: error.message 
    });
  }
});

// Delete test method
router.delete('/test-methods/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM test_methods WHERE id = $1 RETURNING test_name, method_number',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Test method not found' });
    }

    res.json({ 
      success: true, 
      message: 'Test method deleted successfully',
      testMethod: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error deleting test method:', error);
    res.status(500).json({ 
      error: 'Failed to delete test method',
      details: error.message 
    });
  }
});

// Get system stats
router.get('/system-stats', async (req, res) => {
  try {
    const [users, shipments, samples, testMethods] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM shipments'),
      pool.query('SELECT COUNT(*) FROM samples'),
      pool.query('SELECT COUNT(*) FROM test_methods')
    ]);

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(users.rows[0].count),
        totalShipments: parseInt(shipments.rows[0].count),
        totalSamples: parseInt(samples.rows[0].count),
        totalTestMethods: parseInt(testMethods.rows[0].count)
      }
    });
  } catch (error: any) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch system stats',
      details: error.message 
    });
  }
});

// Get user activity statistics
router.get('/user-activity', async (req, res) => {
  try {
    // Get active users (logged in within last 30 days)
    const activeUsers = await pool.query(`
      SELECT COUNT(*) 
      FROM users 
      WHERE last_login >= NOW() - INTERVAL '30 days'
        AND is_active = true
    `);

    // Get users by role
    const usersByRole = await pool.query(`
      SELECT role, COUNT(*) as count
      FROM users
      WHERE is_active = true
      GROUP BY role
      ORDER BY count DESC
    `);

    // Get recent logins (last 10)
    const recentLogins = await pool.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        role,
        last_login
      FROM users
      WHERE last_login IS NOT NULL
      ORDER BY last_login DESC
      LIMIT 10
    `);

    // Get users who never logged in
    const neverLoggedIn = await pool.query(`
      SELECT COUNT(*)
      FROM users
      WHERE last_login IS NULL
        AND is_active = true
    `);

    // Get login activity by day (last 30 days)
    const loginsByDay = await pool.query(`
      SELECT 
        DATE(last_login) as date,
        COUNT(*) as logins
      FROM users
      WHERE last_login >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(last_login)
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      data: {
        activeUsers: parseInt(activeUsers.rows[0].count),
        usersByRole: usersByRole.rows,
        recentLogins: recentLogins.rows,
        neverLoggedIn: parseInt(neverLoggedIn.rows[0].count),
        loginsByDay: loginsByDay.rows
      }
    });
  } catch (error: any) {
    console.error('Error fetching user activity:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user activity',
      details: error.message 
    });
  }
});

export default router;
