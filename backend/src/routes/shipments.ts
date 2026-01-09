import { Router } from 'express';
import { query } from '../config/database';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Get all shipments
router.get('/', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    let queryText = `
      SELECT s.*,
             sam.chemical_name as sample_name,
             sam.id as sample_identifier,
             ch.hazard_class,
             u1.first_name || ' ' || u1.last_name as requested_by_name,
             u2.first_name || ' ' || u2.last_name as prepared_by_name
      FROM shipments s
      LEFT JOIN samples sam ON s.sample_id = sam.id
      LEFT JOIN chemical_hazards ch ON s.hazard_id = ch.id
      LEFT JOIN users u1 ON s.requested_by = u1.id
      LEFT JOIN users u2 ON s.prepared_by = u2.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      queryText += ` AND s.status = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      queryText += ` AND s.created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      queryText += ` AND s.created_at <= $${params.length}`;
    }

    queryText += ' ORDER BY s.created_at DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get shipment by ID
router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT s.*, 
              sam.chemical_name as sample_name,
              sam.id as sample_identifier,
              ch.hazard_class,
              ch.handling_instructions,
              u1.first_name || ' ' || u1.last_name as requested_by_name,
              u2.first_name || ' ' || u2.last_name as prepared_by_name
       FROM shipments s
       LEFT JOIN samples sam ON s.sample_id = sam.id
       LEFT JOIN chemical_hazards ch ON s.hazard_id = ch.id
       LEFT JOIN users u1 ON s.requested_by = u1.id
       LEFT JOIN users u2 ON s.prepared_by = u2.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Shipment not found', 404);
    }

    // Get chain of custody
    const custody = await query(
      `SELECT coc.*, 
              u.first_name || ' ' || u.last_name as performed_by_name
       FROM shipment_chain_of_custody coc
       LEFT JOIN users u ON coc.performed_by = u.id
       WHERE coc.shipment_id = $1
       ORDER BY coc.event_timestamp ASC`,
      [id]
    );

    // Get supplies used
    const supplies = await query(
      `SELECT ssu.*, 
              ss.supply_name,
              ss.supply_type
       FROM shipment_supplies_used ssu
       JOIN shipping_supplies ss ON ssu.supply_id = ss.id
       WHERE ssu.shipment_id = $1`,
      [id]
    );

    res.json({
      ...result.rows[0],
      chain_of_custody: custody.rows,
      supplies_used: supplies.rows,
    });
  } catch (error) {
    next(error);
  }
});

// Create shipment request
router.post('/', authenticate, authorize('admin', 'lab_staff', 'logistics'), async (req: AuthRequest, res, next) => {
  try {
    const {
      sample_id,
      lot_number,
      chemical_name,
      amount_shipped,
      unit,
      hazard_class,
      un_number,
      recipient_name,
      recipient_address,
      recipient_city,
      recipient_state,
      recipient_zip,
      recipient_country,
      notes,
    } = req.body;

    if (!sample_id || !amount_shipped || !unit || !recipient_name || !recipient_address) {
      throw new AppError('Missing required fields', 400);
    }

    // Get current sample quantity and validate
    const sampleResult = await query(
      `SELECT quantity FROM samples WHERE id = $1 AND status = 'active'`,
      [sample_id]
    );

    if (sampleResult.rows.length === 0) {
      throw new AppError('Sample not found or not active', 404);
    }

    const currentQuantity = sampleResult.rows[0].quantity;
    
    // Parse quantity string (e.g., "12.86g" or "1: 0.91g, 2: 3.91g")
    const quantityMatch = currentQuantity.match(/[\d.]+/g);
    if (!quantityMatch) {
      throw new AppError('Invalid sample quantity format', 400);
    }
    
    const totalAvailable = quantityMatch.reduce((sum: number, val: string) => sum + parseFloat(val), 0);
    const amountToShip = parseFloat(amount_shipped);

    // Validate sufficient quantity
    if (amountToShip > totalAvailable) {
      throw new AppError(`Insufficient quantity. Available: ${totalAvailable}${unit}, Requested: ${amountToShip}${unit}`, 400);
    }

    // Calculate new quantity
    const remainingQuantity = totalAvailable - amountToShip;
    const newQuantityString = remainingQuantity > 0 ? `${remainingQuantity}${unit}` : '0';

    // Generate shipment number
    const shipmentNumber = `SHIP-${Date.now()}`;

    // Create shipment
    const result = await query(
      `INSERT INTO shipments
       (shipment_number, sample_id, lot_number, amount_shipped, unit,
        recipient_name, destination_address, destination_city,
        destination_state, destination_zip, destination_country, special_instructions, requested_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
       RETURNING *`,
      [
        shipmentNumber,
        sample_id,
        lot_number,
        amountToShip,
        unit,
        recipient_name,
        recipient_address,
        recipient_city,
        recipient_state,
        recipient_zip,
        recipient_country,
        notes,
        req.user?.id,
      ]
    );

    // Update sample quantity
    await query(
      `UPDATE samples 
       SET quantity = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [newQuantityString, sample_id]
    );

    // If quantity is now 0, mark as depleted
    if (remainingQuantity === 0) {
      await query(
        `UPDATE samples 
         SET status = 'depleted', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [sample_id]
      );
    }

    // Create initial chain of custody entry
    await query(
      `INSERT INTO shipment_chain_of_custody (shipment_id, event_type, performed_by, notes)
       VALUES ($1, 'created', $2, $3)`,
      [result.rows[0].id, req.user?.id, `Shipped ${amountToShip}${unit}. Remaining: ${remainingQuantity}${unit}`]
    );

    res.status(201).json({ 
      success: true, 
      data: result.rows[0],
      message: `Shipment created. Sample quantity updated: ${totalAvailable}${unit} → ${remainingQuantity}${unit}`
    });
  } catch (error) {
    next(error);
  }
});

// Update shipment status
router.patch('/:id/status', authenticate, authorize('admin', 'logistics'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { status, carrier, trackingNumber, notes } = req.body;

    if (!status) {
      throw new AppError('Status is required', 400);
    }

    const updateFields: string[] = ['status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];

    if (carrier) {
      params.push(carrier);
      updateFields.push(`carrier = $${params.length}`);
    }

    if (trackingNumber) {
      params.push(trackingNumber);
      updateFields.push(`tracking_number = $${params.length}`);
    }

    if (status === 'shipped') {
      updateFields.push('shipped_date = CURRENT_TIMESTAMP');
    }

    params.push(id);
    const result = await query(
      `UPDATE shipments 
       SET ${updateFields.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new AppError('Shipment not found', 404);
    }

    // Add to chain of custody
    await query(
      `INSERT INTO shipment_chain_of_custody (shipment_id, event_type, performed_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [id, status, req.user?.id, notes || `Status updated to ${status}`]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Record supplies used for shipment
router.post('/:id/supplies', authenticate, authorize('admin', 'logistics'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { supplies } = req.body; // Array of {supplyId, quantityUsed}

    if (!supplies || !Array.isArray(supplies)) {
      throw new AppError('Supplies array is required', 400);
    }

    // Insert supplies used
    for (const supply of supplies) {
      await query(
        `INSERT INTO shipment_supplies_used (shipment_id, supply_id, quantity_used)
         VALUES ($1, $2, $3)
         ON CONFLICT (shipment_id, supply_id) DO UPDATE SET quantity_used = $3`,
        [id, supply.supplyId, supply.quantityUsed]
      );

      // Subtract from supply inventory
      await query(
        `UPDATE shipping_supplies 
         SET current_quantity = current_quantity - $1
         WHERE id = $2`,
        [supply.quantityUsed, supply.supplyId]
      );

      // Log transaction
      const supplyData = await query('SELECT current_quantity FROM shipping_supplies WHERE id = $1', [supply.supplyId]);
      const newQuantity = supplyData.rows[0].current_quantity;

      await query(
        `INSERT INTO supply_transactions (supply_id, transaction_type, quantity_change, quantity_before, quantity_after, performed_by, notes)
         VALUES ($1, 'usage', $2, $3, $4, $5, $6)`,
        [
          supply.supplyId,
          -supply.quantityUsed,
          newQuantity + supply.quantityUsed,
          newQuantity,
          req.user?.id,
          `Used for shipment ${id}`,
        ]
      );
    }

    res.json({ message: 'Supplies recorded successfully' });
  } catch (error) {
    next(error);
  }
});

// Get all shipping supplies
router.get('/supplies/all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { status, type } = req.query;
    
    let queryText = 'SELECT * FROM shipping_supplies WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      queryText += ` AND status = $${params.length}`;
    }

    if (type) {
      params.push(type);
      queryText += ` AND supply_type = $${params.length}`;
    }

    queryText += ' ORDER BY un_box_type';

    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Update supply inventory
router.post('/supplies/:id/restock', authenticate, authorize('admin', 'logistics'), async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const { quantity, notes } = req.body;

    if (!quantity) {
      throw new AppError('Quantity is required', 400);
    }

    const supplyData = await query('SELECT count FROM shipping_supplies WHERE id = $1', [id]);

    if (supplyData.rows.length === 0) {
      throw new AppError('Supply not found', 404);
    }

    const oldQuantity = supplyData.rows[0].count;
    const newQuantity = oldQuantity + parseInt(quantity);

    await query(
      `UPDATE shipping_supplies SET count = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newQuantity, id]
    );

    res.json({ message: 'Supply restocked successfully', newQuantity });
  } catch (error) {
    next(error);
  }
});

// Get low stock supplies
router.get('/supplies/alerts/low-stock', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM shipping_supplies 
       WHERE current_quantity <= low_stock_threshold 
       ORDER BY current_quantity ASC`
    );

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get hazard classifications
router.get('/hazards/all', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const result = await query('SELECT * FROM chemical_hazards ORDER BY hazard_class');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

export default router;
