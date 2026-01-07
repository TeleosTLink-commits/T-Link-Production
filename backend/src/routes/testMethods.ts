import { Router } from 'express';
import { Pool } from 'pg';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';


// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join('C:', 'T_Link', 'storage', 'test-methods');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
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
  password: process.env.DB_PASSWORD || 'Ajwa8770',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Get statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_methods,
        COUNT(CASE WHEN is_current_version = true THEN 1 END) as current_versions,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_methods,
        COUNT(DISTINCT tm_number) as unique_methods
      FROM test_methods
      WHERE status != 'archived'
    `;

    const byStatusQuery = `
      SELECT status, COUNT(*) as count
      FROM test_methods
      WHERE status != 'archived'
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

// Get all test methods (with filters and pagination)
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status,
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const conditions: string[] = [];
    const values: any[] = [];
    let valueIndex = 1;

    // Search by tm_number or title
    if (search) {
      conditions.push(`(
        tm_number ILIKE $${valueIndex} OR
        title ILIKE $${valueIndex}
      )`);
      values.push(`%${search}%`);
      valueIndex++;
    }

    // Filters
    if (status) {
      conditions.push(`status = $${valueIndex}`);
      values.push(status);
      valueIndex++;
    } else {
      conditions.push("status != 'archived'");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countQuery = `
      SELECT COUNT(*) FROM test_methods tm ${whereClause}
    `;
    const countResult = await pool.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Get data
    const dataQuery = `
      SELECT id, tm_number, version, title, description, file_path, file_name, status, is_current_version, created_at, updated_at 
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
      `SELECT id, tm_number, version, title, description, file_path, file_name, status, is_current_version, created_by, created_at, updated_at
      FROM test_methods
      WHERE id = $1`,
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
      legacy_number,
      legacy_lab_source,
      original_title,
      official_number,
      official_title,
      category_id,
      method_type,
      status = 'draft',
      verification_status = 'pending',
      purpose,
      scope,
      principle,
      equipment_required,
      reagents_required,
      procedure,
      calculations,
      acceptance_criteria,
      references,
      verification_notes,
    } = req.body;

    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    const result = await pool.query(
      `INSERT INTO test_methods (
        legacy_number, legacy_lab_source, original_title,
        official_number, official_title, category_id, method_type,
        status, verification_status,
        purpose, scope, principle,
        equipment_required, reagents_required, procedure,
        calculations, acceptance_criteria, references,
        verification_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        legacy_number || null,
        legacy_lab_source || null,
        original_title,
        official_number || null,
        official_title || null,
        category_id || null,
        method_type || null,
        status,
        verification_status,
        purpose || null,
        scope || null,
        principle || null,
        equipment_required || null,
        reagents_required || null,
        procedure || null,
        calculations || null,
        acceptance_criteria || null,
        references || null,
        verification_notes || null,
        userId,
      ]
    );

    // Create initial version history
    await pool.query(
      `INSERT INTO test_method_versions (
        test_method_id, version_number, change_type, change_description,
        legacy_number, official_number, title, status, changed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        result.rows[0].id,
        '1.0',
        'initial_creation',
        'Test method created',
        legacy_number || null,
        official_number || null,
        original_title,
        status,
        userId,
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
    const { legacy_number, display_title, original_title, official_number, method_type, status, verification_status, effective_date, aal_verification_date } = req.body;
    console.log('UPDATE REQUEST:', { legacy_number, display_title, original_title, official_number, method_type });
    const titleToUse = original_title;
    const result = await pool.query(
      `UPDATE test_methods SET legacy_number = $1, original_title = $2, official_number = $3, method_type = $4, status = $5, verification_status = $6, effective_date = $7, verified_date = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *`,
      [legacy_number, titleToUse, official_number || null, method_type, status || 'active', verification_status || 'pending_review', effective_date || null, aal_verification_date || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Test method not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating test method:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update test method' });
  }
});


// Standardize test method (assign official number)
router.post('/:id/standardize', authenticate, authorize('admin', 'lab_user'), async (req, res) => {
  try {
    const { id } = req.params;
    const { official_number, official_title } = req.body;

    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    const result = await pool.query(
      `UPDATE test_methods SET
        official_number = $1,
        official_title = COALESCE($2, official_title),
        status = CASE WHEN status = 'draft' THEN 'standardized' ELSE status END
      WHERE id = $3
      RETURNING *`,
      [official_number, official_title || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Test method not found' });
    }

    // Create version history
    await pool.query(
      `INSERT INTO test_method_versions (
        test_method_id, version_number, change_type, change_description,
        official_number, changed_by
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        result.rows[0].current_version,
        'standardization',
        `Standardized with official number: ${official_number}`,
        official_number,
        userId,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error standardizing test method:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to standardize' });
  }
});

// Verify test method
router.post('/:id/verify', authenticate, authorize('admin', 'lab_user'), async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_notes } = req.body;

    const authReq = req as AuthRequest;
    const userId = authReq.user!.id;

    const result = await pool.query(
      `UPDATE test_methods SET
        verification_status = 'verified',
        status = CASE WHEN status = 'draft' THEN 'verified' ELSE status END,
        verified_by = $1,
        verified_date = CURRENT_DATE,
        verification_notes = $2
      WHERE id = $3
      RETURNING *`,
      [userId, verification_notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Test method not found' });
    }

    // Create version history
    await pool.query(
      `INSERT INTO test_method_versions (
        test_method_id, version_number, change_type, change_description,
        changed_by, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        result.rows[0].current_version,
        'verification',
        'Test method verified',
        userId,
        verification_notes || null,
      ]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error verifying test method:', error);
    res.status(500).json({ success: false, message: 'Failed to verify test method' });
  }
});

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

    const filePath = req.file.path;
    const fileName = req.file.originalname;

    const result = await pool.query(
      'UPDATE test_methods SET file_path = $1, file_name = $2 WHERE id = $3 RETURNING *',
      [filePath, fileName, id]
    );

    if (result.rows.length === 0) {
      // Delete uploaded file if test method not found
      fs.unlinkSync(filePath);
      return res.status(404).json({ success: false, message: 'Test method not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'File uploaded successfully' });
  } catch (error: any) {
    if (req.file) {
      fs.unlinkSync(req.file.path); // Clean up file on error
    }
    console.error('Error uploading file:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to upload file' });
  }
});
// Download test method file
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT file_path, file_name, original_title FROM test_methods WHERE id = $1', [id]);
    
    if (result.rows.length === 0 || !result.rows[0].file_path) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    const filePath = result.rows[0].file_path;
    const fileName = result.rows[0].file_name || `${result.rows[0].original_title}.pdf`;
    
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







