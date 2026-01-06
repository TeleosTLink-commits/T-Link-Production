import { Router } from 'express';
import { query } from '../config/database';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all samples
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status, freezerId, search } = req.query;
    
    let queryText = `
      SELECT s.*, 
             f.freezer_name,
             fs.shelf_number,
             coa.lot_number as coa_lot_number,
             u.first_name || ' ' || u.last_name as created_by_name
      FROM samples s
      LEFT JOIN freezers f ON s.freezer_id = f.id
      LEFT JOIN freezer_shelves fs ON s.shelf_id = fs.id
      LEFT JOIN certificates_of_analysis coa ON s.coa_id = coa.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      queryText += ` AND s.status = $${params.length}`;
    }

    if (freezerId) {
      params.push(freezerId);
      queryText += ` AND s.freezer_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (s.sample_id ILIKE $${params.length} OR s.sample_name ILIKE $${params.length} OR s.lot_number ILIKE $${params.length})`;
    }

    queryText += ' ORDER BY s.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get sample by ID
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT s.*, 
              f.freezer_name,
              f.location as freezer_location,
              fs.shelf_number,
              coa.lot_number as coa_lot_number,
              u.first_name || ' ' || u.last_name as created_by_name
       FROM samples s
       LEFT JOIN freezers f ON s.freezer_id = f.id
       LEFT JOIN freezer_shelves fs ON s.shelf_id = fs.id
       LEFT JOIN certificates_of_analysis coa ON s.coa_id = coa.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Sample not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Create new sample
router.post('/', authenticate, authorize('admin', 'lab_staff'), async (req: AuthRequest, res, next) => {
  try {
    const {
      sampleId,
      lotNumber,
      sampleName,
      sampleType,
      coaId,
      initialVolume,
      unit,
      lowInventoryThreshold,
      freezerId,
      shelfId,
      receivedDate,
      expirationDate,
      notes,
    } = req.body;

    if (!sampleId || !sampleName || !sampleType || !initialVolume || !unit || !receivedDate) {
      throw new AppError('Missing required fields', 400);
    }

    // Check if sample ID exists
    const existing = await query('SELECT id FROM samples WHERE sample_id = $1', [sampleId]);
    
    if (existing.rows.length > 0) {
      throw new AppError('Sample ID already exists', 409);
    }

    const result = await query(
      `INSERT INTO samples 
       (sample_id, lot_number, sample_name, sample_type, coa_id, initial_volume, current_volume, 
        unit, low_inventory_threshold, freezer_id, shelf_id, received_date, expiration_date, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        sampleId,
        lotNumber,
        sampleName,
        sampleType,
        coaId,
        initialVolume,
        unit,
        lowInventoryThreshold || initialVolume * 0.2,
        freezerId,
        shelfId,
        receivedDate,
        expirationDate,
        notes,
        req.user?.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Checkout sample (subtract volume)
router.post('/:id/checkout', authenticate, authorize('admin', 'lab_staff'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { amountUsed, testMethodId, purpose, notes } = req.body;

    if (!amountUsed) {
      throw new AppError('Amount used is required', 400);
    }

    // Get current sample data
    const sampleResult = await query('SELECT * FROM samples WHERE id = $1', [id]);
    
    if (sampleResult.rows.length === 0) {
      throw new AppError('Sample not found', 404);
    }

    const sample = sampleResult.rows[0];
    const newVolume = parseFloat(sample.current_volume) - parseFloat(amountUsed);

    if (newVolume < 0) {
      throw new AppError('Insufficient sample volume', 400);
    }

    // Update sample volume
    const updatedSample = await query(
      'UPDATE samples SET current_volume = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [newVolume, id]
    );

    // Log transaction
    await query(
      `INSERT INTO sample_transactions 
       (sample_id, transaction_type, amount_used, unit, volume_before, volume_after, test_method_id, purpose, performed_by, notes)
       VALUES ($1, 'checkout', $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, amountUsed, sample.unit, sample.current_volume, newVolume, testMethodId, purpose, req.user?.id, notes]
    );

    // Check if alert needed
    if (newVolume <= sample.low_inventory_threshold && sample.current_volume > sample.low_inventory_threshold) {
      await query(
        `INSERT INTO inventory_alerts 
         (sample_id, alert_type, alert_message, current_volume, threshold_volume)
         VALUES ($1, 'low_inventory', $2, $3, $4)`,
        [
          id,
          `Sample ${sample.sample_name} (${sample.sample_id}) has reached low inventory threshold`,
          newVolume,
          sample.low_inventory_threshold,
        ]
      );
    }

    res.json(updatedSample.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get sample transaction history
router.get('/:id/transactions', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT st.*, 
              u.first_name || ' ' || u.last_name as performed_by_name,
              tm.title as test_method_title
       FROM sample_transactions st
       LEFT JOIN users u ON st.performed_by = u.id
       LEFT JOIN test_methods tm ON st.test_method_id = tm.id
       WHERE st.sample_id = $1
       ORDER BY st.transaction_date DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get low inventory alerts
router.get('/alerts/low-inventory', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { resolved } = req.query;
    
    let queryText = `
      SELECT ia.*, 
             s.sample_id,
             s.sample_name,
             s.current_volume,
             s.unit,
             f.freezer_name
      FROM inventory_alerts ia
      JOIN samples s ON ia.sample_id = s.id
      LEFT JOIN freezers f ON s.freezer_id = f.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (resolved !== undefined) {
      params.push(resolved === 'true');
      queryText += ` AND ia.is_resolved = $${params.length}`;
    }

    queryText += ' ORDER BY ia.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Mark alert as resolved
router.patch('/alerts/:alertId/resolve', authenticate, authorize('admin', 'lab_staff'), async (req: AuthRequest, res, next) => {
  try {
    const { alertId } = req.params;

    const result = await query(
      `UPDATE inventory_alerts 
       SET is_resolved = true, resolved_at = CURRENT_TIMESTAMP, resolved_by = $1
       WHERE id = $2
       RETURNING *`,
      [req.user?.id, alertId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Alert not found', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get all freezers
router.get('/freezers/all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT f.*, 
              COUNT(DISTINCT s.id) as sample_count
       FROM freezers f
       LEFT JOIN samples s ON f.id = s.freezer_id AND s.status != 'depleted'
       WHERE f.is_active = true
       GROUP BY f.id
       ORDER BY f.freezer_name`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
