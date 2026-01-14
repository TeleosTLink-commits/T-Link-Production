import express, { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router: Router = express.Router();

// Database pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tlink_db',
  password: process.env.DB_PASSWORD || 'Ajwa8770',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

/**
 * Middleware: Check if user is lab staff
 */
const checkLabStaff = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (user.role !== 'lab_staff' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Lab staff or admin role required.' });
  }
  next();
};

/**
 * GET /api/processing/shipments
 * Get all shipments in "initiated" status that need processing
 */
router.get('/shipments', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT s.id, s.shipment_number, s.status, s.lot_number, s.amount_shipped, s.unit,
              s.recipient_name, s.destination_address, s.is_hazmat, s.requires_dg_declaration,
              s.scheduled_ship_date, s.created_at,
              u.first_name, u.last_name, u.email,
              mc.company_name
       FROM shipments s
       JOIN users u ON s.manufacturer_user_id = u.id
       JOIN manufacturer_companies mc ON s.company_id = mc.id
       WHERE s.status = 'initiated'
       ORDER BY s.created_at ASC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit as string) || 50, parseInt(offset as string) || 0]
    );

    res.json({
      success: true,
      count: result.rows.length,
      shipments: result.rows.map((row: any) => ({
        id: row.id,
        shipment_number: row.shipment_number,
        lot_number: row.lot_number,
        quantity: row.amount_shipped,
        unit: row.unit,
        recipient: {
          name: row.recipient_name,
          address: row.destination_address,
        },
        manufacturer: {
          name: `${row.first_name} ${row.last_name}`,
          company: row.company_name,
          email: row.email,
        },
        is_hazmat: row.is_hazmat,
        requires_dg: row.requires_dg_declaration,
        scheduled_ship_date: row.scheduled_ship_date,
        created_at: row.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching processing shipments:', error);
    res.status(500).json({
      error: 'Failed to fetch shipments',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/processing/shipments/:shipmentId/details
 * Get detailed processing info for a shipment (sample info, inventory, SDS)
 */
router.get('/shipments/:shipmentId/details', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;

    // Get shipment details
    const shipmentResult = await pool.query(
      `SELECT s.*, u.first_name, u.last_name, u.email, mc.company_name
       FROM shipments s
       JOIN users u ON s.manufacturer_user_id = u.id
       JOIN manufacturer_companies mc ON s.company_id = mc.id
       WHERE s.id = $1`,
      [shipmentId]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = shipmentResult.rows[0];

    // Get sample details and inventory
    const sampleResult = await pool.query(
      `SELECT id, sample_name, lot_number, current_quantity, quantity_unit, description
       FROM samples
       WHERE lot_number = $1`,
      [shipment.lot_number]
    );

    if (sampleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const sample = sampleResult.rows[0];

    // Calculate inventory projection
    const projectedRemaining = sample.current_quantity - shipment.amount_shipped;

    // Get SDS documents for this lot
    const sdsResult = await pool.query(
      `SELECT id, sds_file_name, sds_file_path, chemical_name, revision_date, supplier_name
       FROM sample_sds_documents
       WHERE lot_number = $1 AND is_current = true`,
      [shipment.lot_number]
    );

    // Get chemical hazard information if hazmat
    let hazardInfo = null;
    if (shipment.is_hazmat && shipment.hazard_id) {
      const hazardResult = await pool.query(
        `SELECT id, chemical_name, hazard_class, un_number, proper_shipping_name
         FROM chemical_hazards
         WHERE id = $1`,
        [shipment.hazard_id]
      );
      if (hazardResult.rows.length > 0) {
        hazardInfo = hazardResult.rows[0];
      }
    }

    res.json({
      success: true,
      shipment: {
        id: shipment.id,
        shipment_number: shipment.shipment_number,
        status: shipment.status,
        lot_number: shipment.lot_number,
        recipient: {
          name: shipment.recipient_name,
          address: shipment.destination_address,
        },
        manufacturer: {
          name: `${shipment.first_name} ${shipment.last_name}`,
          company: shipment.company_name,
          email: shipment.email,
        },
        scheduled_ship_date: shipment.scheduled_ship_date,
        is_hazmat: shipment.is_hazmat,
        requires_dg_declaration: shipment.requires_dg_declaration,
      },
      sample: {
        id: sample.id,
        name: sample.sample_name,
        lot_number: sample.lot_number,
        description: sample.description,
      },
      inventory: {
        current_quantity: sample.current_quantity,
        unit: sample.quantity_unit,
        requested_amount: shipment.amount_shipped,
        projected_remaining: projectedRemaining,
        sufficient_stock: projectedRemaining >= 0,
      },
      sds_documents: sdsResult.rows.map((row: any) => ({
        id: row.id,
        filename: row.sds_file_name,
        filepath: row.sds_file_path,
        chemical_name: row.chemical_name,
        revision_date: row.revision_date,
        supplier: row.supplier_name,
      })),
      hazard_info: hazardInfo,
    });
  } catch (error: any) {
    console.error('Error fetching shipment details:', error);
    res.status(500).json({
      error: 'Failed to fetch shipment details',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/processing/shipments/:shipmentId/update-status
 * Update shipment status to "processing"
 */
router.post('/shipments/:shipmentId/update-status', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const userId = (req as any).user.id;
    const { new_status } = req.body;

    // Validate status
    const validStatuses = ['processing', 'shipped', 'delivered'];
    if (!validStatuses.includes(new_status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Update shipment
    const result = await pool.query(
      `UPDATE shipments 
       SET status = $1, prepared_by = $2, updated_at = NOW()
       WHERE id = $3 AND status IN ('initiated', 'processing')
       RETURNING *`,
      [new_status, userId, shipmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found or cannot be updated' });
    }

    // Log in chain of custody
    const eventType = new_status === 'processing' ? 'processing_started' : 'label_generated';
    await pool.query(
      `INSERT INTO shipment_chain_of_custody (shipment_id, event_type, performed_by, location)
       VALUES ($1, $2, $3, $4)`,
      [shipmentId, eventType, userId, 'Lab Processing']
    );

    res.json({
      success: true,
      message: `Shipment status updated to ${new_status}`,
      shipment: {
        id: result.rows[0].id,
        shipment_number: result.rows[0].shipment_number,
        status: result.rows[0].status,
        lot_number: result.rows[0].lot_number,
      },
    });
  } catch (error: any) {
    console.error('Error updating shipment status:', error);
    res.status(500).json({
      error: 'Failed to update shipment status',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/processing/supplies
 * Get shipping supplies inventory
 */
router.get('/supplies', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, supply_name, supply_type, current_quantity, unit, low_stock_threshold, status
       FROM shipping_supplies
       ORDER BY supply_type ASC, supply_name ASC`
    );

    res.json({
      success: true,
      supplies: result.rows.map((row: any) => ({
        id: row.id,
        name: row.supply_name,
        type: row.supply_type,
        current_quantity: row.current_quantity,
        unit: row.unit,
        low_stock_threshold: row.low_stock_threshold,
        status: row.status,
        is_low_stock: row.current_quantity <= row.low_stock_threshold,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching supplies:', error);
    res.status(500).json({
      error: 'Failed to fetch supplies',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/processing/shipments/:shipmentId/record-supplies
 * Record which supplies were used for a shipment
 */
router.post('/shipments/:shipmentId/record-supplies', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const { shipmentId } = req.params;
    const userId = (req as any).user.id;
    const { supplies_used } = req.body; // Array of { supply_id, quantity_used }

    if (!Array.isArray(supplies_used) || supplies_used.length === 0) {
      return res.status(400).json({ error: 'supplies_used must be a non-empty array' });
    }

    await client.query('BEGIN');

    // Record supplies used
    for (const supply of supplies_used) {
      const { supply_id, quantity_used } = supply;

      // Get current quantity
      const supplyResult = await client.query(
        'SELECT current_quantity FROM shipping_supplies WHERE id = $1',
        [supply_id]
      );

      if (supplyResult.rows.length === 0) {
        throw new Error(`Supply ${supply_id} not found`);
      }

      const currentQty = supplyResult.rows[0].current_quantity;
      const newQty = currentQty - quantity_used;

      // Update supply quantity
      await client.query('UPDATE shipping_supplies SET current_quantity = $1 WHERE id = $2', [newQty, supply_id]);

      // Record in shipment_supplies_used
      await client.query(
        `INSERT INTO shipment_supplies_used (shipment_id, supply_id, quantity_used)
         VALUES ($1, $2, $3)
         ON CONFLICT (shipment_id, supply_id) DO UPDATE SET quantity_used = $3`,
        [shipmentId, supply_id, quantity_used]
      );

      // Record transaction
      await client.query(
        `INSERT INTO supply_transactions (supply_id, transaction_type, quantity_change, quantity_before, quantity_after, performed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [supply_id, 'usage', -quantity_used, currentQty, newQty, userId]
      );
    }

    // Log in chain of custody
    await client.query(
      `INSERT INTO shipment_chain_of_custody (shipment_id, event_type, performed_by, location, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [shipmentId, 'packed', userId, 'Lab Packaging', `${supplies_used.length} supply type(s) recorded`]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Supplies recorded successfully',
      supplies_recorded: supplies_used.length,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('Error recording supplies:', error);
    res.status(500).json({
      error: 'Failed to record supplies',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/processing/shipments/:shipmentId/flag-hazmat
 * Flag shipment as hazmat and require DG declaration
 */
router.post('/shipments/:shipmentId/flag-hazmat', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const { un_number, proper_shipping_name, hazard_class, packing_group, packaging_type } = req.body;

    // Get shipment
    const shipmentResult = await pool.query('SELECT amount_shipped, unit FROM shipments WHERE id = $1', [
      shipmentId,
    ]);

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = shipmentResult.rows[0];

    // Check if quantity meets hazmat threshold (>= 30ml)
    if (shipment.unit === 'ml' && shipment.amount_shipped < 30) {
      return res.status(400).json({
        error: 'Shipment does not meet hazmat threshold (30ml)',
        quantity: shipment.amount_shipped,
        unit: shipment.unit,
      });
    }

    // Update shipment hazmat flags
    await pool.query(
      `UPDATE shipments 
       SET is_hazmat = true, requires_dg_declaration = true 
       WHERE id = $1`,
      [shipmentId]
    );

    // Create DG declaration record
    const dgId = uuidv4();
    const dgFormNumber = `DG-${Date.now()}`;

    await pool.query(
      `INSERT INTO dangerous_goods_declarations 
       (id, shipment_id, dg_form_number, un_number, proper_shipping_name, hazard_class, 
        packing_group, packaging_type, quantity_shipped, unit_of_measure, warning_labels_required)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        dgId,
        shipmentId,
        dgFormNumber,
        un_number,
        proper_shipping_name,
        hazard_class,
        packing_group || null,
        packaging_type || null,
        shipment.amount_shipped,
        shipment.unit,
        true,
      ]
    );

    res.json({
      success: true,
      message: 'Shipment flagged as hazmat and DG declaration created',
      dg_declaration: {
        id: dgId,
        form_number: dgFormNumber,
        un_number,
        hazard_class,
        requires_warning_labels: true,
      },
    });
  } catch (error: any) {
    console.error('Error flagging hazmat:', error);
    res.status(500).json({
      error: 'Failed to flag hazmat',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/processing/shipments/:shipmentId/print-warning-labels
 * Mark warning labels as printed
 */
router.post('/shipments/:shipmentId/print-warning-labels', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { shipmentId } = req.params;
    const userId = (req as any).user.id;

    // Get DG declaration
    const dgResult = await pool.query('SELECT id FROM dangerous_goods_declarations WHERE shipment_id = $1', [
      shipmentId,
    ]);

    if (dgResult.rows.length === 0) {
      return res.status(404).json({ error: 'No DG declaration found for this shipment' });
    }

    const dgId = dgResult.rows[0].id;

    // Update warning labels as printed
    const result = await pool.query(
      `UPDATE dangerous_goods_declarations 
       SET warning_labels_printed = true, warning_labels_printed_by = $1, warning_labels_printed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, dgId]
    );

    // Log event
    await pool.query(
      `INSERT INTO shipment_chain_of_custody (shipment_id, event_type, performed_by, notes)
       VALUES ($1, $2, $3, $4)`,
      [shipmentId, 'hazmat_flagged', userId, 'Warning labels printed']
    );

    res.json({
      success: true,
      message: 'Warning labels marked as printed',
      dg_declaration: {
        id: result.rows[0].id,
        warning_labels_printed: result.rows[0].warning_labels_printed,
        warning_labels_printed_at: result.rows[0].warning_labels_printed_at,
      },
    });
  } catch (error: any) {
    console.error('Error marking labels as printed:', error);
    res.status(500).json({
      error: 'Failed to mark labels as printed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
