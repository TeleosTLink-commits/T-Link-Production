import { Router } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Allowed upload directories for path validation
const ALLOWED_UPLOAD_DIRS = [
  path.resolve('C:', 'T_Link', 'storage', 'test-methods'),
  path.resolve(process.cwd(), 'uploads'),
  path.resolve(process.cwd(), 'storage', 'test-methods'),
];

/**
 * Validate that a file path is within allowed directories (prevent path traversal)
 */
const isPathSafe = (filePath: string): boolean => {
  const resolvedPath = path.resolve(filePath);
  return ALLOWED_UPLOAD_DIRS.some(dir => resolvedPath.startsWith(dir));
};

/**
 * Safely delete a file only if it's in an allowed directory
 */
const safeUnlink = (filePath: string): void => {
  // Validate path before any filesystem operation
  const resolvedPath = path.resolve(filePath);
  const isAllowed = ALLOWED_UPLOAD_DIRS.some(dir => resolvedPath.startsWith(dir));
  if (isAllowed && fs.existsSync(resolvedPath)) {
    fs.unlinkSync(resolvedPath);
  }
};

// Configure multer for file uploads - use validated directory
const UPLOAD_DIR = ALLOWED_UPLOAD_DIRS[0]; // Use first allowed directory

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use pre-validated directory constant
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, Word, and Excel files are allowed'));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});
const router = Router();
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tlink_db',
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Get statistics (new schema)
router.get('/stats', authenticate, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_methods,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_methods,
        COUNT(CASE WHEN status = 'superseded' THEN 1 END) as superseded_methods,
        COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived_methods,
        COUNT(CASE WHEN is_current_version = true THEN 1 END) as current_version_count
      FROM test_methods
    `;

    const byStatusQuery = `
      SELECT status, COUNT(*) as count
      FROM test_methods
      GROUP BY status
      ORDER BY count DESC
    `;

    const [statsResult, statusResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(byStatusQuery),
    ]);

    res.json({
      success: true,
      data: {
        ...statsResult.rows[0],
        by_status: statusResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Error fetching test methods stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
  }
});

// Get all categories (return empty since table doesn't exist in production)
router.get('/categories', authenticate, async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

// Get all test methods (with filters and pagination) using new schema
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      search = '',
      status,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const values: any[] = [];
    let valueIndex = 1;

    // Search by tm_number, version, or title
    if (search) {
      conditions.push(`(
        tm_number ILIKE $${valueIndex} OR
        title ILIKE $${valueIndex} OR
        version ILIKE $${valueIndex}
      )`);
      values.push(`%${search}%`);
      valueIndex++;
    }

    // Filters
    if (status) {
      conditions.push(`status = $${valueIndex}`);
      values.push(status);
      valueIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countQuery = `
      SELECT COUNT(*) FROM test_methods tm ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get data with new schema
    const dataQuery = `
      SELECT id, tm_number, version, title, description,
             file_path, file_name, is_current_version, status,
             approved_by, approved_at, created_by, created_at, updated_at
      FROM test_methods ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
    `;
    values.push(Number(limit), offset);

    const dataResult = await pool.query(dataQuery, values);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Error fetching test methods:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch test methods' });
  }
});

// Get single test method by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM test_methods WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Test method not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching test method:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch test method' });
  }
});

// Get version history for a test method
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    // Version history not available in production schema
    res.json({ success: true, data: [] });
  } catch (error: any) {
    console.error('Error fetching version history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch version history' });
  }
});

// Get files for a test method
router.get('/:id/files', authenticate, async (req, res) => {
  try {
    // File management not available in production schema
    res.json({ success: true, data: [] });
  } catch (error: any) {
    console.error('Error fetching files:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch files' });
  }
});

// Create new test method
router.post('/', authenticate, authorize('admin', 'lab_user'), async (req, res) => {
  try {
    const {
      tm_number,
      version,
      title,
      description,
      is_current_version = true,
      status = 'active',
    } = req.body;

    if (!tm_number || !version || !title) {
      return res.status(400).json({ 
        success: false, 
        message: 'tm_number, version, and title are required' 
      });
    }

    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    const result = await pool.query(
      `INSERT INTO test_methods (
        tm_number, version, title, description,
        is_current_version, status, created_by, file_path, file_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        tm_number,
        version,
        title,
        description || null,
        is_current_version,
        status,
        userId,
        '', // file_path - will be set when file is uploaded
        '', // file_name - will be set when file is uploaded
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating test method:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create test method' });
  }
});

// Update test method
router.put('/:id', authenticate, authorize('admin', 'lab_user'), async (req, res) => {
  try {
    const { id } = req.params;
    const { tm_number, version, title, description, is_current_version, status } = req.body;

    const result = await pool.query(
      `UPDATE test_methods 
       SET tm_number = COALESCE($1, tm_number),
           version = COALESCE($2, version),
           title = COALESCE($3, title),
           description = COALESCE($4, description),
           is_current_version = COALESCE($5, is_current_version),
           status = COALESCE($6, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 
       RETURNING *`,
      [tm_number || null, version || null, title || null, description || null, 
       is_current_version !== undefined ? is_current_version : null, status || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Test method not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating test method:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update test method' });
  }
});


// NOTE: standardization/verification workflows removed for the simplified schema

// Archive test method (soft delete)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE test_methods SET status = 'archived' WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Test method not found' });
    }

    res.json({ success: true, message: 'Test method archived successfully' });
  } catch (error: any) {
    console.error('Error archiving test method:', error);
    res.status(500).json({ success: false, message: 'Failed to archive test method' });
  }
});



// Upload file for test method
router.post('/:id/upload', authenticate, authorize('admin', 'lab_user'), upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    let filePath = req.file.path;
    const fileName = req.file.originalname;

    // In production, upload to Cloudinary instead of using local disk
    if (process.env.NODE_ENV === 'production') {
      const { uploadToCloudinary } = require('../utils/cloudinary');
      try {
        filePath = await uploadToCloudinary(req.file.path, 'test-methods');
        if (!filePath) {
          return res.status(500).json({ success: false, message: 'Failed to upload file to cloud' });
        }
        // Delete the temporary file after uploading to Cloudinary (safe delete)
        if (isPathSafe(req.file.path)) {
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
          });
        }
      } catch (cloudError: any) {
        console.error('Cloudinary upload error:', cloudError);
        return res.status(500).json({ success: false, message: 'Failed to upload to cloud storage', error: cloudError.message });
      }
    }

    const result = await pool.query(
      'UPDATE test_methods SET file_path = $1, file_name = $2 WHERE id = $3 RETURNING *',
      [filePath, fileName, id]
    );

    if (result.rows.length === 0) {
      // Delete uploaded file if test method not found (safe delete)
      safeUnlink(req.file.path);
      return res.status(404).json({ success: false, message: 'Test method not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'File uploaded successfully' });
  } catch (error: any) {
    if (req.file) {
      safeUnlink(req.file.path); // Clean up file on error (safe delete)
    }
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload file' });
  }
});
// Download test method file
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT file_path, file_name, title FROM test_methods WHERE id = $1', [id]);
    
    if (result.rows.length === 0 || !result.rows[0].file_path) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    const filePath = result.rows[0].file_path;
    const fileName = result.rows[0].file_name || `${result.rows[0].title || 'test-method'}.pdf`;

    if (filePath.startsWith('http')) {
      return res.redirect(filePath);
    }

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Failed to download file' });
        }
      }
    });
  } catch (error: any) {
    console.error('Error serving file:', error);
    res.status(500).json({ success: false, message: 'Failed to serve file' });
  }
});
export default router;







