import { Router } from 'express';
import { query } from '../config/database';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/coa'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Get COA statistics
router.get('/stats', authenticate, async (req: AuthRequest, res, next) => {
  try {
    // Count COAs from certificates_of_analysis table (which now includes all sample COAs)
    const result = await query(`
      SELECT COUNT(*) as total_coas
      FROM certificates_of_analysis
    `);
    
    res.json({ 
      success: true, 
      data: { 
        total_coas: parseInt(result.rows[0].total_coas)
      } 
    });
  } catch (error) {
    next(error);
  }
});

// Get all CoAs
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status, manufacturerId, search } = req.query;
    
    let queryText = `
      SELECT coa.*, 
             mc.company_name as manufacturer_name,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM certificates_of_analysis coa
      LEFT JOIN manufacturer_companies mc ON coa.manufacturer_id = mc.id
      LEFT JOIN users u ON coa.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      queryText += ` AND coa.status = $${params.length}`;
    }

    if (manufacturerId) {
      params.push(manufacturerId);
      queryText += ` AND coa.manufacturer_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (coa.lot_number ILIKE $${params.length} OR coa.product_name ILIKE $${params.length})`;
    }

    queryText += ' ORDER BY coa.expiration_date ASC, coa.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get CoA by lot number
router.get('/lot/:lotNumber', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { lotNumber } = req.params;

    const result = await query(
      `SELECT coa.*, 
              mc.company_name as manufacturer_name,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM certificates_of_analysis coa
       LEFT JOIN manufacturer_companies mc ON coa.manufacturer_id = mc.id
       LEFT JOIN users u ON coa.created_by = u.id
       WHERE coa.lot_number = $1`,
      [lotNumber]
    );

    if (result.rows.length === 0) {
      throw new AppError('CoA not found', 404);
    }

    // Log audit trail
    await query(
      `INSERT INTO document_audit_log (document_type, document_id, action, performed_by)
       VALUES ('coa', $1, 'viewed', $2)`,
      [result.rows[0].id, req.user?.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Download CoA file by lot number
router.get('/lot/:lotNumber/download', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { lotNumber } = req.params;

    const result = await query(
      'SELECT id, lot_number, file_path, file_name FROM certificates_of_analysis WHERE lot_number = $1',
      [lotNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'CoA not found' });
    }

    const { id, file_path, file_name } = result.rows[0];

    if (!file_path || !fs.existsSync(file_path)) {
      return res.status(404).json({ success: false, message: 'CoA file not found on server' });
    }

    // Audit log
    await query(
      `INSERT INTO document_audit_log (document_type, document_id, action, performed_by)
       VALUES ('coa', $1, 'downloaded', $2)`,
      [id, req.user?.id]
    );

    res.download(file_path, file_name);
  } catch (error) {
    next(error);
  }
});

// Get CoA by ID
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT coa.*, 
              mc.company_name as manufacturer_name
       FROM certificates_of_analysis coa
       LEFT JOIN manufacturer_companies mc ON coa.manufacturer_id = mc.id
       WHERE coa.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('CoA not found', 404);
    }

    // Audit log
    await query(
      `INSERT INTO document_audit_log (document_type, document_id, action, performed_by)
       VALUES ('coa', $1, 'viewed', $2)`,
      [id, req.user?.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Download CoA file by ID
router.get('/:id/download', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT id, lot_number, file_path, file_name FROM certificates_of_analysis WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'CoA not found' });
    }

    const { file_path, file_name } = result.rows[0];

    if (!file_path || !fs.existsSync(file_path)) {
      return res.status(404).json({ success: false, message: 'CoA file not found on server' });
    }

    // Audit log
    await query(
      `INSERT INTO document_audit_log (document_type, document_id, action, performed_by)
       VALUES ('coa', $1, 'downloaded', $2)`,
      [id, req.user?.id]
    );

    res.download(file_path, file_name);
  } catch (error) {
    next(error);
  }
});

// Create new CoA
router.post('/', authenticate, authorize('admin', 'lab_staff'), upload.single('file'), async (req: AuthRequest, res, next) => {
  try {
    const { lotNumber, productName, manufacturerId, issueDate, expirationDate, notes } = req.body;
    const file = req.file;

    if (!lotNumber || !productName || !manufacturerId || !issueDate || !expirationDate || !file) {
      throw new AppError('Missing required fields', 400);
    }

    // Check if lot number exists
    const existing = await query(
      'SELECT id FROM certificates_of_analysis WHERE lot_number = $1',
      [lotNumber]
    );

    if (existing.rows.length > 0) {
      throw new AppError('Lot number already exists', 409);
    }

    const result = await query(
      `INSERT INTO certificates_of_analysis 
       (lot_number, product_name, manufacturer_id, issue_date, expiration_date, file_path, file_name, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [lotNumber, productName, manufacturerId, issueDate, expirationDate, file.path, file.filename, notes, req.user?.id]
    );

    // Audit log
    await query(
      `INSERT INTO document_audit_log (document_type, document_id, action, performed_by, new_values)
       VALUES ('coa', $1, 'created', $2, $3)`,
      [result.rows[0].id, req.user?.id, JSON.stringify(result.rows[0])]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get expiring CoAs (for alerts)
router.get('/alerts/expiring', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { days } = req.query;
    const daysAhead = parseInt(days as string) || 90;

    const result = await query(
      `SELECT coa.*, 
              mc.company_name as manufacturer_name,
              (coa.expiration_date - CURRENT_DATE) as days_until_expiration
       FROM certificates_of_analysis coa
       LEFT JOIN manufacturer_companies mc ON coa.manufacturer_id = mc.id
       WHERE coa.expiration_date <= CURRENT_DATE + INTERVAL '${daysAhead} days'
         AND coa.expiration_date > CURRENT_DATE
         AND coa.status != 'expired'
       ORDER BY coa.expiration_date ASC`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Update CoA
router.put('/:id', authenticate, authorize('admin', 'lab_staff'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { productName, expirationDate, notes } = req.body;

    const existing = await query('SELECT * FROM certificates_of_analysis WHERE id = $1', [id]);
    
    if (existing.rows.length === 0) {
      throw new AppError('CoA not found', 404);
    }

    const result = await query(
      `UPDATE certificates_of_analysis 
       SET product_name = COALESCE($1, product_name),
           expiration_date = COALESCE($2, expiration_date),
           notes = COALESCE($3, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [productName, expirationDate, notes, id]
    );

    // Audit log
    await query(
      `INSERT INTO document_audit_log (document_type, document_id, action, performed_by, previous_values, new_values)
       VALUES ('coa', $1, 'updated', $2, $3, $4)`,
      [id, req.user?.id, JSON.stringify(existing.rows[0]), JSON.stringify(result.rows[0])]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;

