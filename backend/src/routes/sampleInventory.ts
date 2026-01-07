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
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/sample-documents');
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
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
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
      limit = '50',
      search = '',
      status,
      expirationStatus,
      sortBy = 'sample_name',
      sortOrder = 'asc'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    // Full-text search across sample name, sample_id, lot number
    if (search && search !== '') {
      conditions.push(`(
        sample_name ILIKE $${paramCount} OR 
        sample_id ILIKE $${paramCount} OR 
        lot_number ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (status) {
      conditions.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    // Expiration status filtering
    if (expirationStatus) {
      switch (expirationStatus) {
        case 'expired':
          conditions.push(`expiration_date < CURRENT_DATE`);
          break;
        case 'expiring_30':
          conditions.push(`expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`);
          break;
        case 'expiring_60':
          conditions.push(`expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'`);
          break;
        case 'expiring_90':
          conditions.push(`expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'`);
          break;
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['sample_name', 'sample_id', 'lot_number', 'received_date', 'expiration_date', 'status'];
    const sortColumn = allowedSortColumns.includes(sortBy as string) ? sortBy : 'sample_name';
    const orderDirection = sortOrder === 'desc' ? 'DESC' : 'ASC';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM samples ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count);

    // Get samples
    const samplesResult = await pool.query(
      `SELECT 
        id,
        sample_id,
        sample_name,
        sample_type,
        lot_number,
        received_date,
        expiration_date,
        current_volume,
        initial_volume,
        unit,
        low_inventory_threshold,
        status,
        coa_id,
        notes,
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
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch inventory', error: error.message });
  }
});

// GET /api/sample-inventory/expiring - Get samples expiring soon
router.get('/expiring', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { days = '30' } = req.query;
    
    const result = await pool.query(
      `SELECT 
        id,
        sample_name,
        sample_id,
        lot_number,
        current_volume,
        expiration_date,
        sample_type,
        EXTRACT(DAY FROM (expiration_date - CURRENT_DATE)) as days_until_expiration
       FROM samples
       WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::INTEGER * INTERVAL '1 day'
       AND status != 'expired'
       ORDER BY expiration_date ASC`,
      [parseInt(days as string)]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('Error fetching expiring samples:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expiring samples', error: error.message });
  }
});

// GET /api/sample-inventory/stats - Get inventory statistics
router.get('/stats', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total_samples,
        COUNT(*) FILTER (WHERE status = 'available') as available_samples,
        COUNT(*) FILTER (WHERE status = 'low') as low_samples,
        COUNT(*) FILTER (WHERE status = 'depleted') as depleted_samples,
        COUNT(*) FILTER (WHERE status = 'quarantine') as quarantine_samples,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_samples,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE) as needs_review,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE + INTERVAL '30 days' 
                        AND expiration_date >= CURRENT_DATE) as expiring_30_days,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE + INTERVAL '60 days' 
                        AND expiration_date >= CURRENT_DATE) as expiring_60_days,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE + INTERVAL '90 days' 
                        AND expiration_date >= CURRENT_DATE) as expiring_90_days,
        COUNT(*) FILTER (WHERE coa_id IS NOT NULL) as with_coa
      FROM samples
    `);

    const sampleTypesResult = await pool.query(`
      SELECT sample_type, COUNT(*) as count
      FROM samples
      WHERE sample_type IS NOT NULL AND sample_type != ''
      GROUP BY sample_type
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        ...statsResult.rows[0],
        sample_types: sampleTypesResult.rows
      }
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch statistics', error: error.message });
  }
});

// GET /api/sample-inventory/:id - Get single sample details with transaction history
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const sampleResult = await pool.query(
      `SELECT 
        s.*,
        u.username as created_by_name,
        CASE
          WHEN s.expiration_date < CURRENT_DATE THEN 'expired'
          WHEN s.expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon_30'
          WHEN s.expiration_date < CURRENT_DATE + INTERVAL '60 days' THEN 'expiring_soon_60'
          WHEN s.expiration_date < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon_90'
          ELSE 'valid'
        END as expiration_status
       FROM samples s
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (sampleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    // Get transaction history
    const transactionsResult = await pool.query(
      `SELECT 
        t.*,
        u.username as performed_by_name
       FROM sample_transactions t
       LEFT JOIN users u ON t.performed_by = u.id
       WHERE t.sample_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        sample: sampleResult.rows[0],
        transactions: transactionsResult.rows
      }
    });
  } catch (error: any) {
    console.error('Error fetching sample:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch sample', error: error.message });
  }
});

// POST /api/sample-inventory - Create new sample
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      sample_id,
      sample_name,
      sample_type,
      lot_number,
      received_date,
      expiration_date,
      initial_volume,
      current_volume,
      unit,
      low_inventory_threshold,
      status,
      coa_id,
      notes
    } = req.body;

    const userId = (req as any).user.id;

    // Validate required fields
    if (!sample_id || !sample_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'sample_id and sample_name are required' 
      });
    }

    // Convert empty strings to null for date fields
    const cleanedData = {
      received_date: received_date || null,
      expiration_date: expiration_date || null
    };

    const result = await pool.query(
      `INSERT INTO samples (
        sample_id,
        sample_name,
        sample_type,
        lot_number,
        received_date,
        expiration_date,
        initial_volume,
        current_volume,
        unit,
        low_inventory_threshold,
        status,
        coa_id,
        notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        sample_id,
        sample_name,
        sample_type || 'Standard',
        lot_number,
        cleanedData.received_date,
        cleanedData.expiration_date,
        initial_volume || 0,
        current_volume || 0,
        unit || 'mL',
        low_inventory_threshold || 0,
        status || 'available',
        coa_id || null,
        notes || null,
        userId
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Sample created successfully',
      data: result.rows[0]
    });
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
      sample_id,
      sample_name,
      sample_type,
      lot_number,
      received_date,
      expiration_date,
      initial_volume,
      current_volume,
      unit,
      low_inventory_threshold,
      status,
      coa_id,
      notes
    } = req.body;

    const userId = (req as any).user.id;

    // Build dynamic UPDATE query based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (sample_id !== undefined) {
      updates.push(`sample_id = $${paramIndex++}`);
      values.push(sample_id);
    }
    if (sample_name !== undefined) {
      updates.push(`sample_name = $${paramIndex++}`);
      values.push(sample_name);
    }
    if (sample_type !== undefined) {
      updates.push(`sample_type = $${paramIndex++}`);
      values.push(sample_type);
    }
    if (lot_number !== undefined) {
      updates.push(`lot_number = $${paramIndex++}`);
      values.push(lot_number);
    }
    if (received_date !== undefined) {
      updates.push(`received_date = $${paramIndex++}`);
      values.push(received_date || null);
    }
    if (expiration_date !== undefined) {
      updates.push(`expiration_date = $${paramIndex++}`);
      values.push(expiration_date || null);
    }
    if (initial_volume !== undefined) {
      updates.push(`initial_volume = $${paramIndex++}`);
      values.push(initial_volume);
    }
    if (current_volume !== undefined) {
      updates.push(`current_volume = $${paramIndex++}`);
      values.push(current_volume);
    }
    if (unit !== undefined) {
      updates.push(`unit = $${paramIndex++}`);
      values.push(unit);
    }
    if (low_inventory_threshold !== undefined) {
      updates.push(`low_inventory_threshold = $${paramIndex++}`);
      values.push(low_inventory_threshold);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (coa_id !== undefined) {
      updates.push(`coa_id = $${paramIndex++}`);
      values.push(coa_id || null);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(notes);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE samples SET
        ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    res.json({
      success: true,
      message: 'Sample updated successfully',
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error updating sample:', error);
    res.status(500).json({ success: false, message: 'Failed to update sample', error: error.message });
  }
});

// GET /api/sample-inventory/:id/coa/download - Download COA file for sample
router.get('/:id/coa/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get file path from database
    const result = await pool.query(
      'SELECT coa_file_path, coa_file_name FROM samples WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const sample = result.rows[0];
    if (!sample.coa_file_path) {
      return res.status(404).json({ success: false, message: 'COA file not found for this sample' });
    }

    // Check if file exists
    if (!fs.existsSync(sample.coa_file_path)) {
      return res.status(404).json({ success: false, message: 'COA file not found on server' });
    }

    // Send file
    res.download(sample.coa_file_path, sample.coa_file_name || 'coa.pdf');
  } catch (error: any) {
    console.error('Error downloading COA:', error);
    res.status(500).json({ success: false, message: 'Failed to download COA', error: error.message });
  }
});

// GET /api/sample-inventory/:id/sds/download - Download SDS file for sample
router.get('/:id/sds/download', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get file path from database
    const result = await pool.query(
      'SELECT sds_file_path, sds_file_name FROM samples WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const sample = result.rows[0];
    if (!sample.sds_file_path) {
      return res.status(404).json({ success: false, message: 'SDS file not found for this sample' });
    }

    // Check if file exists
    if (!fs.existsSync(sample.sds_file_path)) {
      return res.status(404).json({ success: false, message: 'SDS file not found on server' });
    }

    // Send file
    res.download(sample.sds_file_path, sample.sds_file_name || 'sds.pdf');
  } catch (error: any) {
    console.error('Error downloading SDS:', error);
    res.status(500).json({ success: false, message: 'Failed to download SDS', error: error.message });
  }
});

// POST /api/sample-inventory/:id/coa/upload - Upload COA file for sample
router.post('/:id/coa/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Get the sample's lot number
    const sampleResult = await pool.query(
      'SELECT lot_number FROM samples WHERE id = $1',
      [id]
    );

    if (sampleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const lotNumber = sampleResult.rows[0].lot_number;

    // Update sample with file information
    await pool.query(
      `UPDATE samples
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Also update the certificates_of_analysis table if a matching lot number exists
    await pool.query(
      `UPDATE certificates_of_analysis
       SET file_path = $1, file_name = $2, updated_at = CURRENT_TIMESTAMP
       WHERE lot_number = $3`,
      [file.path, file.originalname, lotNumber]
    );

    res.json({
      success: true,
      message: 'COA file uploaded successfully',
      fileName: file.originalname,
      lotNumber: lotNumber
    });
  } catch (error: any) {
    console.error('Error uploading COA:', error);
    res.status(500).json({ success: false, message: 'Failed to upload COA', error: error.message });
  }
});

// POST /api/sample-inventory/:id/sds/upload - Upload SDS file for sample
router.post('/:id/sds/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Update database with file information
    await pool.query(
      `UPDATE samples
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'SDS file uploaded successfully',
      fileName: file.originalname
    });
  } catch (error: any) {
    console.error('Error uploading SDS:', error);
    res.status(500).json({ success: false, message: 'Failed to upload SDS', error: error.message });
  }
});

// DELETE /api/sample-inventory/:id/coa - Delete COA file for sample
router.delete('/:id/coa', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get sample with COA file info
    const sampleResult = await pool.query(
      'SELECT coa_file_path FROM samples WHERE id = $1',
      [id]
    );

    if (sampleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const sample = sampleResult.rows[0];

    // Delete physical file if it exists
    if (sample.coa_file_path && fs.existsSync(sample.coa_file_path)) {
      fs.unlinkSync(sample.coa_file_path);
    }

    // Update database to remove COA reference
    await pool.query(
      `UPDATE samples 
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'COA file deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting COA:', error);
    res.status(500).json({ success: false, message: 'Failed to delete COA', error: error.message });
  }
});

// DELETE /api/sample-inventory/:id/sds - Delete SDS file for sample
router.delete('/:id/sds', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get sample with SDS file info
    const sampleResult = await pool.query(
      'SELECT sds_file_path FROM samples WHERE id = $1',
      [id]
    );

    if (sampleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    const sample = sampleResult.rows[0];

    // Delete physical file if it exists
    if (sample.sds_file_path && fs.existsSync(sample.sds_file_path)) {
      fs.unlinkSync(sample.sds_file_path);
    }

    // Update database to remove SDS reference
    await pool.query(
      `UPDATE samples 
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'SDS file deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting SDS:', error);
    res.status(500).json({ success: false, message: 'Failed to delete SDS', error: error.message });
  }
});

export default router;
