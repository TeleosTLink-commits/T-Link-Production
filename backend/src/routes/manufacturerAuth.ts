import express, { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validators';
import pool from '../config/database';

const router: Router = express.Router();

// Manufacturer signup validation
const manufacturerSignupValidator = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters'),
  body('first_name').trim().isLength({ min: 1, max: 50 }).isAlpha('en-US', { ignore: " '-" }).withMessage('Valid first name required'),
  body('last_name').trim().isLength({ min: 1, max: 50 }).isAlpha('en-US', { ignore: " '-" }).withMessage('Valid last name required'),
  body('company_name').trim().isLength({ min: 1, max: 100 }).withMessage('Company name is required'),
  body('contact_phone').optional().trim().isMobilePhone('any', { strictMode: false }).withMessage('Invalid phone format'),
  handleValidationErrors
];

// Manufacturer login validation
const manufacturerLoginValidator = [
  body('email').trim().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 1, max: 128 }).withMessage('Password is required'),
  handleValidationErrors
];

/**
 * POST /api/auth/manufacturer/signup
 * Register a new manufacturer user
 */
router.post('/signup', manufacturerSignupValidator, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { email, password, first_name, last_name, company_name, contact_phone, address } = req.body;

    // Normalize email to lowercase for consistent comparison
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is in authorized list (case-insensitive)
    const authorizedCheck = await client.query(
      'SELECT id FROM authorized_emails WHERE LOWER(email) = $1 AND role = $2',
      [normalizedEmail, 'manufacturer']
    );

    if (authorizedCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'This email is not authorized to register as a manufacturer. Please contact support.',
      });
    }

    // Check if user already exists (case-insensitive)
    const existingUser = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Start transaction
    await client.query('BEGIN');

    // Create user with normalized email
    const userId = uuidv4();
    const userResult = await client.query(
      `INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, first_name, last_name, role`,
      [userId, normalizedEmail, normalizedEmail, password_hash, first_name, last_name, 'manufacturer', true]
    );

    // Create or link to manufacturer company
    let companyId: string;
    const existingCompany = await client.query(
      'SELECT id FROM manufacturer_companies WHERE company_name = $1',
      [company_name]
    );

    if (existingCompany.rows.length > 0) {
      companyId = existingCompany.rows[0].id;
    } else {
      companyId = uuidv4();
      await client.query(
        `INSERT INTO manufacturer_companies (id, company_name, contact_email, contact_phone, address, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [companyId, company_name, email, contact_phone || null, address || null, true]
      );
    }

    // Link user to company
    await client.query(
      `INSERT INTO manufacturer_users (user_id, company_id) VALUES ($1, $2)
       ON CONFLICT (user_id, company_id) DO NOTHING`,
      [userId, companyId]
    );

    await client.query('COMMIT');

    // Generate JWT token
    const token = jwt.sign(
      {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        role: userResult.rows[0].role,
        first_name: userResult.rows[0].first_name,
        last_name: userResult.rows[0].last_name,
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Manufacturer account created successfully',
      token,
      user: {
        id: userResult.rows[0].id,
        email: userResult.rows[0].email,
        first_name: userResult.rows[0].first_name,
        last_name: userResult.rows[0].last_name,
        company_name,
        role: userResult.rows[0].role,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('Error during manufacturer signup:', error);

    if (error.code === '23505') {
      // Unique violation
      return res.status(409).json({ error: 'Email or username already exists' });
    }

    res.status(500).json({
      error: 'Failed to create manufacturer account',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/auth/manufacturer/login
 * Login a manufacturer user (uses existing auth endpoint)
 * Included here for completeness - manufacturer login uses standard /api/auth/login
 */
router.post('/login', manufacturerLoginValidator, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Query user
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND role = $2', [email, 'manufacturer']);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Generate token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Error during manufacturer login:', error);
    res.status(500).json({
      error: 'Failed to login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/auth/manufacturer/profile
 * Get current manufacturer profile
 */
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get user with company info
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
              mc.id as company_id, mc.company_name, mc.contact_email, mc.contact_phone, mc.address, mc.website
       FROM users u
       LEFT JOIN manufacturer_users mu ON u.id = mu.user_id
       LEFT JOIN manufacturer_companies mc ON mu.company_id = mc.id
       WHERE u.id = $1 AND u.role = $2`,
      [userId, 'manufacturer']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Manufacturer profile not found' });
    }

    const profile = result.rows[0];
    res.json({
      user: {
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name,
        last_name: profile.last_name,
        role: profile.role,
        created_at: profile.created_at,
      },
      company: profile.company_id
        ? {
            id: profile.company_id,
            name: profile.company_name,
            email: profile.contact_email,
            phone: profile.contact_phone,
            address: profile.address,
            website: profile.website,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error fetching manufacturer profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
