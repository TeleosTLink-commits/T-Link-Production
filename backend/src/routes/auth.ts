import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';
import { AuthRequest, authenticate } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Get user
    const result = await query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active, 
              failed_login_attempts, locked_until
       FROM users 
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid email or password', 401);
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      throw new AppError(`Account is locked. Try again in ${minutesLeft} minutes.`, 423);
    }

    // Check if account is active
    if (!user.is_active) {
      throw new AppError('Account is disabled. Contact your administrator.', 403);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      // Increment failed attempts
      const failedAttempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60000) : null;

      await query(
        `UPDATE users 
         SET failed_login_attempts = $1, locked_until = $2
         WHERE id = $3`,
        [failedAttempts, lockUntil, user.id]
      );

      if (failedAttempts >= 5) {
        throw new AppError('Too many failed attempts. Account locked for 15 minutes.', 423);
      }

      throw new AppError('Invalid email or password', 401);
    }

    // Successful login - reset failed attempts and update last_login
    await query(
      `UPDATE users 
       SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Register (only if email is authorized)
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    if (!email || !password || !first_name || !last_name) {
      throw new AppError('All fields are required', 400);
    }

    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    // Check if email is authorized
    const authCheck = await query(
      'SELECT * FROM authorized_emails WHERE email = $1',
      [email.toLowerCase()]
    );

    if (authCheck.rows.length === 0) {
      throw new AppError('This email is not authorized to register. Please contact your administrator.', 403);
    }

    const authorizedEmail = authCheck.rows[0];

    // Check if user already exists
    const existingUser = await query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('User with this email already exists', 409);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user with role from authorized_emails
    const result = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified, username)
       VALUES ($1, $2, $3, $4, $5, true, true, $1)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), password_hash, first_name, last_name, authorizedEmail.role]
    );

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at
       FROM users 
       WHERE id = $1`,
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Check if email is authorized
router.post('/check-email', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      throw new AppError('Email is required', 400);
    }

    const result = await query(
      'SELECT email, role FROM authorized_emails WHERE email = $1',
      [email.toLowerCase()]
    );

    const isAuthorized = result.rows.length > 0;
    
    res.json({
      success: true,
      data: {
        authorized: isAuthorized,
        role: isAuthorized ? result.rows[0].role : null
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
