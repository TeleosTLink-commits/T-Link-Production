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
      hazardClass,
      status,
      expirationStatus,
      hasCoa,
      hasSds,
      sortBy = 'chemical_name',
      sortOrder = 'asc'
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    // Full-text search across chemical name, CAS number, lot number
    if (search && search !== '') {
      conditions.push(`(
        chemical_name ILIKE $${paramCount} OR 
        cas_number ILIKE $${paramCount} OR 
        lot_number ILIKE $${paramCount} OR
        search_vector @@ plainto_tsquery('english', $${paramCount})
      )`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (hazardClass) {
      conditions.push(`hazard_class = $${paramCount}`);
      params.push(hazardClass);
      paramCount++;
    }

    if (status) {
      conditions.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (hasCoa !== undefined) {
      conditions.push(`has_coa = $${paramCount}`);
      params.push(hasCoa === 'true');
      paramCount++;
    }

    if (hasSds !== undefined) {
      conditions.push(`has_dow_sds = $${paramCount}`);
      params.push(hasSds === 'true');
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
    const allowedSortColumns = ['chemical_name', 'lot_number', 'received_date', 'expiration_date', 'hazard_class', 'status'];
    const sortColumn = allowedSortColumns.includes(sortBy as string) ? sortBy : 'chemical_name';
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
        chemical_name,
        lot_number,
        quantity,
        expiration_date,
        hazard_class,
        cas_number,
        EXTRACT(DAY FROM (expiration_date - CURRENT_DATE)) as days_until_expiration
       FROM samples
       WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::INTEGER * INTERVAL '1 day'
       AND status = 'active'
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
        COUNT(*) FILTER (WHERE status = 'active') as active_samples,
        COUNT(*) FILTER (WHERE status = 'expired') as expired_samples,
        COUNT(*) FILTER (WHERE status = 'depleted') as depleted_samples,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE AND status = 'active') as needs_review,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE + INTERVAL '30 days' 
                        AND expiration_date >= CURRENT_DATE 
                        AND status = 'active') as expiring_30_days,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE + INTERVAL '60 days' 
                        AND expiration_date >= CURRENT_DATE 
                        AND status = 'active') as expiring_60_days,
        COUNT(*) FILTER (WHERE expiration_date < CURRENT_DATE + INTERVAL '90 days' 
                        AND expiration_date >= CURRENT_DATE 
                        AND status = 'active') as expiring_90_days,
        COUNT(*) FILTER (WHERE has_coa = true) as with_coa,
        COUNT(*) FILTER (WHERE has_dow_sds = true) as with_sds,
        COUNT(DISTINCT hazard_class) FILTER (WHERE hazard_class IS NOT NULL) as hazard_classes_count
      FROM samples
    `);

    const hazardClassesResult = await pool.query(`
      SELECT hazard_class, COUNT(*) as count
      FROM samples
      WHERE hazard_class IS NOT NULL AND hazard_class != ''
      GROUP BY hazard_class
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        ...statsResult.rows[0],
        hazard_classes: hazardClassesResult.rows
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
      notes
    } = req.body;

    const userId = (req as any).user.id;

    // Convert empty strings to null for date fields
    const cleanedData = {
      received_date: received_date || null,
      certification_date: certification_date || null,
      recertification_date: recertification_date || null,
      expiration_date: expiration_date || null
    };

    const result = await pool.query(
      `INSERT INTO samples (
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
        created_by,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'active')
      RETURNING *`,
      [
        chemical_name,
        cleanedData.received_date,
        lot_number,
        quantity,
        concentration,
        has_dow_sds,
        cas_number,
        has_coa,
        cleanedData.certification_date,
        cleanedData.recertification_date,
        cleanedData.expiration_date,
        un_number,
        hazard_description,
        hs_code,
        hazard_class,
        packing_group,
        packing_instruction,
        userId
      ]
    );

    // Log creation transaction
    if (notes) {
      await pool.query(
        `INSERT INTO sample_transactions (sample_id, transaction_type, notes, performed_by)
         VALUES ($1, 'created', $2, $3)`,
        [result.rows[0].id, notes, userId]
      );
    }

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

    const userId = (req as any).user.id;

    // Convert empty strings to null for date fields
    const cleanedData = {
      received_date: received_date || null,
      certification_date: certification_date || null,
      recertification_date: recertification_date || null,
      expiration_date: expiration_date || null
    };

    // Convert empty strings to null for date fields
    const cleanedReceivedDate = received_date === '' ? null : received_date;
    const cleanedCertificationDate = certification_date === '' ? null : certification_date;
    const cleanedRecertificationDate = recertification_date === '' ? null : recertification_date;
    const cleanedExpirationDate = expiration_date === '' ? null : expiration_date;

    const result = await pool.query(
      `UPDATE samples SET
        chemical_name = COALESCE($1, chemical_name),
        received_date = COALESCE($2, received_date),
        lot_number = COALESCE($3, lot_number),
        quantity = COALESCE($4, quantity),
        concentration = COALESCE($5, concentration),
        has_dow_sds = COALESCE($6, has_dow_sds),
        cas_number = COALESCE($7, cas_number),
        has_coa = COALESCE($8, has_coa),
        certification_date = COALESCE($9, certification_date),
        recertification_date = COALESCE($10, recertification_date),
        expiration_date = COALESCE($11, expiration_date),
        un_number = COALESCE($12, un_number),
        hazard_description = COALESCE($13, hazard_description),
        hs_code = COALESCE($14, hs_code),
        hazard_class = COALESCE($15, hazard_class),
        packing_group = COALESCE($16, packing_group),
        packing_instruction = COALESCE($17, packing_instruction),
        status = COALESCE($18, status),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $19
       RETURNING *`,
      [
        chemical_name,
        cleanedReceivedDate,
        lot_number,
        quantity,
        concentration,
        has_dow_sds,
        cas_number,
        has_coa,
        cleanedCertificationDate,
        cleanedRecertificationDate,
        cleanedExpirationDate,
        un_number,
        hazard_description,
        hs_code,
        hazard_class,
        packing_group,
        packing_instruction,
        status,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Sample not found' });
    }

    // Log update transaction
    if (notes) {
      await pool.query(
        `INSERT INTO sample_transactions (sample_id, transaction_type, notes, performed_by)
         VALUES ($1, 'updated', $2, $3)`,
        [id, notes, userId]
      );
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
       SET coa_file_path = $1, coa_file_name = $2, has_coa = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [file.path, file.originalname, id]
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
       SET sds_file_path = $1, sds_file_name = $2, has_dow_sds = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [file.path, file.originalname, id]
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
       SET coa_file_path = NULL, coa_file_name = NULL, has_coa = false, updated_at = CURRENT_TIMESTAMP
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
       SET sds_file_path = NULL, sds_file_name = NULL, has_dow_sds = false, updated_at = CURRENT_TIMESTAMP
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
