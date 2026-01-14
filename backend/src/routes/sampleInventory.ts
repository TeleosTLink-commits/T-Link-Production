import { Router, Response } from 'express';
import { Pool } from 'pg';
import { AuthRequest, authenticate } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Configure multer for file uploads
// Use memory storage in production (Render) to avoid Windows path issues,
// and disk storage locally for development.
const storage = process.env.NODE_ENV === 'production'
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = 'C\\T_Link\\storage\\sample-inventory';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (extname) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOC files are allowed'));
    }
  }
});

// GET /api/sample-inventory - List all samples with pagination, search, and filtering
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      status,
      sortBy = 'chemical_name',
      sortOrder = 'asc'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (search && search !== '') {
      conditions.push(`(
        chemical_name ILIKE $${paramCount} OR 
        lot_number ILIKE $${paramCount} OR 
        cas_number ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (status) {
      conditions.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSortColumns = ['chemical_name', 'lot_number', 'received_date', 'expiration_date', 'status'];
    const sortColumn = allowedSortColumns.includes(sortBy as string) ? sortBy : 'chemical_name';
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM samples ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    const samplesResult = await pool.query(
      `SELECT 
        id,
        chemical_name,
        received_date,
        lot_number,
        quantity,
        concentration,
        has_dow_sds,
        cas_number,
        has_coa,
        certification_date,
        recertification_date,
        expiration_date,
        un_number,
        hazard_description,
        hs_code,
        hazard_class,
        packing_group,
        packing_instruction,
        status,
        notes,
        coa_file_path,
        coa_file_name,
        sds_file_path,
        sds_file_name,
        created_at,
        updated_at,
        CASE
          WHEN expiration_date < CURRENT_DATE THEN 'expired'
          WHEN expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon_30'
          WHEN expiration_date < CURRENT_DATE + INTERVAL '60 days' THEN 'expiring_soon_60'
          WHEN expiration_date < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon_90'
          ELSE 'valid'
        END as expiration_status
       FROM samples
       ${whereClause}
       ORDER BY ${sortColumn} ${orderDirection}
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    res.json({
      success: true,
      data: {
        samples: samplesResult.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit as string))
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching sample inventory:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sample inventory', error: error.message });
  }
});

// GET /api/sample-inventory/stats - Get inventory statistics
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_samples,
        COUNT(*) FILTER (WHERE status = 'active') as active_samples,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE) as expired_samples,
        COUNT(*) FILTER (WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') as expiring_30_days,
        COUNT(*) FILTER (WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days') as expiring_60_days,
        COUNT(*) FILTER (WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days') as expiring_90_days,
        COUNT(*) FILTER (WHERE coa_file_path IS NOT NULL) as with_coa,
        COUNT(*) FILTER (WHERE sds_file_path IS NOT NULL) as with_sds
      FROM samples
    `);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
});

// GET /api/sample-inventory/:id - Get single sample
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM samples WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error fetching sample:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sample', error: error.message });
  }
});

// POST /api/sample-inventory - Create new sample
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      chemical_name,
      received_date,
      lot_number,
      quantity,
      concentration,
      has_dow_sds,
      cas_number,
      has_coa,
      certification_date,
      recertification_date,
      expiration_date,
      un_number,
      hazard_description,
      hs_code,
      hazard_class,
      packing_group,
      packing_instruction,
      status,
      notes
    } = req.body;

    const result = await pool.query(
      `INSERT INTO samples (
        chemical_name, received_date, lot_number, quantity, concentration,
        has_dow_sds, cas_number, has_coa, certification_date, recertification_date,
        expiration_date, un_number, hazard_description, hs_code, hazard_class,
        packing_group, packing_instruction, status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        chemical_name, received_date, lot_number, quantity, concentration,
        has_dow_sds || false, cas_number, has_coa || false, certification_date, recertification_date,
        expiration_date, un_number, hazard_description, hs_code, hazard_class,
        packing_group, packing_instruction, status || 'active', notes, req.user?.id
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating sample:', error);
    res.status(500).json({ success: false, message: 'Failed to create sample', error: error.message });
  }
});

// PUT /api/sample-inventory/:id - Update sample
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      chemical_name,
      received_date,
      lot_number,
      quantity,
      concentration,
      has_dow_sds,
      cas_number,
      has_coa,
      certification_date,
      recertification_date,
      expiration_date,
      un_number,
      hazard_description,
      hs_code,
      hazard_class,
      packing_group,
      packing_instruction,
      status,
      notes
    } = req.body;

    const result = await pool.query(
      `UPDATE samples SET
        chemical_name = $1, received_date = $2, lot_number = $3, quantity = $4, concentration = $5,
        has_dow_sds = $6, cas_number = $7, has_coa = $8, certification_date = $9, recertification_date = $10,
        expiration_date = $11, un_number = $12, hazard_description = $13, hs_code = $14, hazard_class = $15,
        packing_group = $16, packing_instruction = $17, status = $18, notes = $19, updated_at = CURRENT_TIMESTAMP
      WHERE id = $20
      RETURNING *`,
      [
        chemical_name, received_date, lot_number, quantity, concentration,
        has_dow_sds, cas_number, has_coa, certification_date, recertification_date,
        expiration_date, un_number, hazard_description, hs_code, hazard_class,
        packing_group, packing_instruction, status, notes, id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating sample:', error);
    res.status(500).json({ success: false, message: 'Failed to update sample', error: error.message });
  }
});

// DELETE /api/sample-inventory/:id - Delete sample
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get file paths before deleting
    const sample = await pool.query('SELECT coa_file_path, sds_file_path FROM samples WHERE id = $1', [id]);

    if (sample.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    // Delete files if they exist
    const { coa_file_path, sds_file_path } = sample.rows[0];
    if (coa_file_path && !coa_file_path.startsWith('http')) {
      const fullPath = path.isAbsolute(coa_file_path) ? coa_file_path : path.join('C:\\T_Link\\storage\\sample-inventory', coa_file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    if (sds_file_path && !sds_file_path.startsWith('http')) {
      const fullPath = path.isAbsolute(sds_file_path) ? sds_file_path : path.join('C:\\T_Link\\storage\\sample-inventory', sds_file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await pool.query('DELETE FROM samples WHERE id = $1', [id]);
    res.json({ success: true, message: 'Sample deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting sample:', error);
    res.status(500).json({ success: false, message: 'Failed to delete sample', error: error.message });
  }
});

// POST /api/sample-inventory/:id/coa/upload - Upload CoA file
router.post('/:id/coa/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const fileName = file.originalname;
    let filePath: string | null = null;

    if (process.env.NODE_ENV === 'production') {
      const { uploadBufferToCloudinary } = require('../utils/cloudinary');
      try {
        filePath = await uploadBufferToCloudinary(file.buffer, fileName, 'sample-inventory/coa');
        if (!filePath) {
          return res.status(500).json({ success: false, message: 'Failed to upload CoA to cloud' });
        }
      } catch (cloudError: any) {
        console.error('Cloudinary upload error:', cloudError);
        return res.status(500).json({ success: false, message: 'Failed to upload to cloud storage', error: cloudError.message });
      }
    } else {
      filePath = (file as any).path;
    }

    await pool.query(
      'UPDATE samples SET coa_file_path = $1, coa_file_name = $2, has_coa = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [filePath, fileName, id]
    );

    res.json({ success: true, message: 'CoA uploaded successfully', data: { filePath, fileName } });
  } catch (error: any) {
    console.error('Error uploading CoA:', error);
    res.status(500).json({ success: false, message: 'Failed to upload CoA', error: error.message });
  }
});

// POST /api/sample-inventory/:id/sds/upload - Upload SDS file
router.post('/:id/sds/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const fileName = file.originalname;
    let filePath: string | null = null;

    if (process.env.NODE_ENV === 'production') {
      const { uploadBufferToCloudinary } = require('../utils/cloudinary');
      try {
        filePath = await uploadBufferToCloudinary(file.buffer, fileName, 'sample-inventory/sds');
        if (!filePath) {
          return res.status(500).json({ success: false, message: 'Failed to upload SDS to cloud' });
        }
      } catch (cloudError: any) {
        console.error('Cloudinary upload error:', cloudError);
        return res.status(500).json({ success: false, message: 'Failed to upload to cloud storage', error: cloudError.message });
      }
    } else {
      filePath = (file as any).path;
    }

    await pool.query(
      'UPDATE samples SET sds_file_path = $1, sds_file_name = $2, has_dow_sds = true, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [filePath, fileName, id]
    );

    res.json({ success: true, message: 'SDS uploaded successfully', data: { filePath, fileName } });
  } catch (error: any) {
    console.error('Error uploading SDS:', error);
    res.status(500).json({ success: false, message: 'Failed to upload SDS', error: error.message });
  }
});

// GET /api/sample-inventory/:id/coa/download - Download/view CoA file
router.get('/:id/coa/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT coa_file_path, coa_file_name FROM samples WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const { coa_file_path, coa_file_name } = result.rows[0];

    if (!coa_file_path) {
      return res.status(404).json({ success: false, message: 'No CoA file found for this sample' });
    }

    // If it's a Cloudinary URL, generate a signed URL for authenticated access
    if (coa_file_path.startsWith('http')) {
      try {
        const { getSignedCloudinaryUrl } = require('../utils/cloudinary');
        const signedUrl = getSignedCloudinaryUrl(coa_file_path, 3600); // 1 hour expiration
        
        // Redirect to the signed URL which grants temporary authenticated access
        return res.redirect(signedUrl);
      } catch (error: any) {
        console.error('Error generating signed URL:', error);
        return res.status(500).json({ success: false, message: 'Failed to generate download link' });
      }
    }

    // Local file
    const fullPath = path.isAbsolute(coa_file_path) ? coa_file_path : path.join('C:\\T_Link\\storage\\sample-inventory', coa_file_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'CoA file not found on server' });
    }

    res.download(fullPath, coa_file_name || 'coa.pdf');
  } catch (error: any) {
    console.error('Error downloading CoA:', error);
    res.status(500).json({ success: false, message: 'Failed to download CoA', error: error.message });
  }
});

// GET /api/sample-inventory/:id/sds/download - Download/view SDS file
router.get('/:id/sds/download', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT sds_file_path, sds_file_name FROM samples WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const { sds_file_path, sds_file_name } = result.rows[0];

    if (!sds_file_path) {
      return res.status(404).json({ success: false, message: 'No SDS file found for this sample' });
    }

    // If it's a Cloudinary URL, generate a signed URL for authenticated access
    if (sds_file_path.startsWith('http')) {
      try {
        const { getSignedCloudinaryUrl } = require('../utils/cloudinary');
        const signedUrl = getSignedCloudinaryUrl(sds_file_path, 3600); // 1 hour expiration
        
        // Redirect to the signed URL which grants temporary authenticated access
        return res.redirect(signedUrl);
      } catch (error: any) {
        console.error('Error generating signed URL:', error);
        return res.status(500).json({ success: false, message: 'Failed to generate download link' });
      }
    }

    // Local file
    const fullPath = path.isAbsolute(sds_file_path) ? sds_file_path : path.join('C:\\T_Link\\storage\\sample-inventory', sds_file_path);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'SDS file not found on server' });
    }

    res.download(fullPath, sds_file_name || 'sds.pdf');
  } catch (error: any) {
    console.error('Error downloading SDS:', error);
    res.status(500).json({ success: false, message: 'Failed to download SDS', error: error.message });
  }
});

// DELETE /api/sample-inventory/:id/coa - Delete CoA file
router.delete('/:id/coa', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT coa_file_path FROM samples WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const { coa_file_path } = result.rows[0];

    if (coa_file_path && !coa_file_path.startsWith('http')) {
      const fullPath = path.isAbsolute(coa_file_path) ? coa_file_path : path.join('C:\\T_Link\\storage\\sample-inventory', coa_file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await pool.query(
      'UPDATE samples SET coa_file_path = NULL, coa_file_name = NULL, has_coa = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({ success: true, message: 'CoA file deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting CoA:', error);
    res.status(500).json({ success: false, message: 'Failed to delete CoA', error: error.message });
  }
});

// DELETE /api/sample-inventory/:id/sds - Delete SDS file
router.delete('/:id/sds', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT sds_file_path FROM samples WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const { sds_file_path } = result.rows[0];

    if (sds_file_path && !sds_file_path.startsWith('http')) {
      const fullPath = path.isAbsolute(sds_file_path) ? sds_file_path : path.join('C:\\T_Link\\storage\\sample-inventory', sds_file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await pool.query(
      'UPDATE samples SET sds_file_path = NULL, sds_file_name = NULL, has_dow_sds = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    res.json({ success: true, message: 'SDS file deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting SDS:', error);
    res.status(500).json({ success: false, message: 'Failed to delete SDS', error: error.message });
  }
});

export default router;

