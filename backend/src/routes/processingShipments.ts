import express, { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import fedexService from '../services/fedexService';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger';

const router: Router = express.Router();

// Allowed directories for file operations (prevent path traversal)
const ALLOWED_LABEL_DIR = path.resolve(__dirname, '../../uploads/shipping-labels');

/**
 * Validate that a file path is within the allowed shipping labels directory
 */
const isLabelPathSafe = (filePath: string): boolean => {
  const resolvedPath = path.resolve(filePath);
  return resolvedPath.startsWith(ALLOWED_LABEL_DIR);
};

// Database pool
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tlink_db',
  password: process.env.DB_PASSWORD || 'Ajwa8770',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

/**
 * Middleware: Check if user is lab staff or admin
 */
const checkLabStaff = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (user.role !== 'lab_staff' && user.role !== 'admin' && user.role !== 'super_admin') {
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
              s.scheduled_ship_date, s.created_at, s.first_name, s.last_name,
              u.email,
              mc.company_name
       FROM shipments s
       LEFT JOIN users u ON s.manufacturer_user_id = u.id
       LEFT JOIN manufacturer_companies mc ON s.company_id = mc.id
       WHERE s.status = 'initiated'
       ORDER BY s.created_at ASC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit as string) || 50, parseInt(offset as string) || 0]
    );

    // Get chemical names from shipment_samples for each shipment
    const shipmentsWithSamples = await Promise.all(
      result.rows.map(async (row: any) => {
        // Try to get chemical name from shipment_samples
        const samplesResult = await pool.query(
          `SELECT sam.chemical_name 
           FROM shipment_samples ss 
           JOIN samples sam ON ss.sample_id = sam.id 
           WHERE ss.shipment_id = $1 
           LIMIT 1`,
          [row.id]
        );
        const chemical_name = samplesResult.rows.length > 0 
          ? samplesResult.rows[0].chemical_name 
          : null;
        
        return {
          id: row.id,
          shipment_number: row.shipment_number,
          lot_number: row.lot_number,
          chemical_name: chemical_name,
          company_name: row.company_name,
          quantity_requested: row.amount_shipped,
          amount_shipped: row.amount_shipped,
          unit: row.unit,
          first_name: row.first_name,
          last_name: row.last_name,
          recipient_name: row.recipient_name,
          scheduled_ship_date: row.scheduled_ship_date,
          is_hazmat: row.is_hazmat,
          requires_dg_declaration: row.requires_dg_declaration,
          created_at: row.created_at,
          status: row.status
        };
      })
    );

    res.json({
      success: true,
      count: shipmentsWithSamples.length,
      data: shipmentsWithSamples,
      shipments: shipmentsWithSamples
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
 * GET /api/processing/supplies
 * Get shipping supplies inventory
 */
router.get('/supplies', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count
       FROM shipping_supplies
       ORDER BY inner_packing_type ASC, item_number ASC`
    );

    const supplies = result.rows.map((row: any) => ({
      id: row.id,
      supply_name: row.item_number || row.un_box_type || 'Unknown',
      supply_type: row.inner_packing_type || 'Other',
      current_quantity: row.count || 0,
      unit: 'units',
    }));

    res.json(supplies);
  } catch (error: any) {
    console.error('Error fetching supplies:', error);
    res.status(500).json({
      error: 'Failed to fetch supplies',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/processing/:id
 * Get shipment by ID for processing view (simplified endpoint)
 */
router.get('/:id', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get shipment details with all necessary information
    const shipmentResult = await pool.query(
      `SELECT s.*, 
              u.first_name as user_first_name, u.last_name as user_last_name, u.email,
              mc.company_name
       FROM shipments s
       LEFT JOIN users u ON s.manufacturer_user_id = u.id
       LEFT JOIN manufacturer_companies mc ON s.company_id = mc.id
       WHERE s.id = $1`,
      [id]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = shipmentResult.rows[0];

    // Get samples from shipment_samples junction table with hazmat info
    const samplesResult = await pool.query(
      `SELECT ss.quantity_requested, ss.unit,
              sam.id as sample_id, sam.chemical_name, sam.cas_number, sam.lot_number, 
              sam.quantity as available_quantity,
              sam.un_number, sam.hazard_class, sam.packing_group, sam.proper_shipping_name,
              sam.sds_file_path, sam.sds_file_name, sam.coa_file_path, sam.coa_file_name
       FROM shipment_samples ss
       JOIN samples sam ON ss.sample_id = sam.id
       WHERE ss.shipment_id = $1`,
      [id]
    );

    // If no shipment_samples, try the legacy sample_id field
    let samples = samplesResult.rows;
    let primarySample = samples.length > 0 ? samples[0] : null;

    if (samples.length === 0 && shipment.sample_id) {
      const legacySampleResult = await pool.query(
        `SELECT id as sample_id, chemical_name, cas_number, lot_number, quantity as available_quantity,
                un_number, hazard_class, packing_group, proper_shipping_name,
                sds_file_path, sds_file_name, coa_file_path, coa_file_name
         FROM samples WHERE id = $1`,
        [shipment.sample_id]
      );
      if (legacySampleResult.rows.length > 0) {
        primarySample = legacySampleResult.rows[0];
        samples = [{ ...primarySample, quantity_requested: shipment.amount_shipped, unit: shipment.unit }];
      }
    }

    // Get SDS documents for the primary sample
    let sdsDocuments = [];
    if (primarySample?.sample_id) {
      const sdsResult = await pool.query(
        `SELECT id, sds_file_name as file_name, sds_file_path as file_path, revision_date, created_at
         FROM sample_sds_documents
         WHERE sample_id = $1
         ORDER BY revision_date DESC, created_at DESC`,
        [primarySample.sample_id]
      );
      sdsDocuments = sdsResult.rows;
    }

    // Also include SDS from the sample directly if available and not in sdsDocuments
    if (primarySample?.sds_file_path && sdsDocuments.length === 0) {
      sdsDocuments.push({
        id: 'direct-sds',
        file_name: primarySample.sds_file_name || 'Safety Data Sheet',
        file_path: primarySample.sds_file_path,
        revision_date: null,
      });
    }

    res.json({
      success: true,
      data: {
        ...shipment,
        // Include primary sample data at top level for backwards compatibility
        chemical_name: primarySample?.chemical_name || null,
        cas_number: primarySample?.cas_number || null,
        sample_lot_number: primarySample?.lot_number || shipment.lot_number,
        available_quantity: primarySample?.available_quantity || null,
        sample_id: primarySample?.sample_id || shipment.sample_id,
        // Hazmat info from primary sample
        un_number: primarySample?.un_number || null,
        hazard_class: primarySample?.hazard_class || null,
        packing_group: primarySample?.packing_group || null,
        proper_shipping_name: primarySample?.proper_shipping_name || null,
        sds_file_path: primarySample?.sds_file_path || null,
        // Multi-sample support
        samples: samples,
        manufacturer_name: `${shipment.user_first_name || shipment.first_name || ''} ${shipment.user_last_name || shipment.last_name || ''}`.trim(),
        manufacturer_email: shipment.email,
        sds_documents: sdsDocuments
      }
    });
  } catch (error) {
    logger.error('Error fetching shipment for processing:', error);
    res.status(500).json({ error: 'Failed to fetch shipment details' });
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

/**
 * POST /api/processing/validate-address
 * Validate delivery address using FedEx API
 */
router.post('/validate-address', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { street, city, state, zip, country } = req.body;

    console.log('Address validation request:', { street, city, state, zip, country });

    if (!street || !city || !state || !zip) {
      console.error('Missing address fields:', { street: !!street, city: !!city, state: !!state, zip: !!zip });
      return res.status(400).json({ error: 'Missing required address fields', received: { street, city, state, zip } });
    }

    const validationResult = await fedexService.validateAddress({
      street,
      city,
      stateOrProvinceCode: state,
      postalCode: zip,
      countryCode: country || 'US',
    });

    res.json({
      success: true,
      data: validationResult,
    });
  } catch (error: any) {
    console.error('Error validating address:', error);
    res.status(500).json({
      error: 'Failed to validate address',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/processing/get-rate
 * Get shipping rate quote from FedEx
 */
router.post('/get-rate', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { toAddress, weight, weightUnit, service, packageValue, isHazmat } = req.body;

    if (!toAddress || !weight || !weightUnit || !service) {
      return res.status(400).json({ error: 'Missing required fields for rate quote' });
    }

    // Get lab address from env or database
    const fromAddress = {
      street: process.env.LAB_ADDRESS_STREET || '123 Lab Street',
      city: process.env.LAB_ADDRESS_CITY || 'Baton Rouge',
      stateOrProvinceCode: process.env.LAB_ADDRESS_STATE || 'LA',
      postalCode: process.env.LAB_ADDRESS_ZIP || '70802',
      countryCode: 'US',
    };

    const rateResult = await fedexService.getShippingRate({
      fromAddress,
      toAddress: {
        street: toAddress.street,
        city: toAddress.city,
        stateOrProvinceCode: toAddress.state,
        postalCode: toAddress.zip,
        countryCode: toAddress.country || 'US',
      },
      weight: parseFloat(weight),
      weightUnit: weightUnit.toUpperCase() as 'LB' | 'KG',
      service: service as any,
      packageValue: parseFloat(packageValue) || 100,
      isHazmat: isHazmat || false,
    });

    res.json({
      success: true,
      data: rateResult,
    });
  } catch (error: any) {
    console.error('Error getting rate:', error);
    res.status(500).json({
      error: 'Failed to get shipping rate',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/processing/generate-label
 * Generate FedEx shipping label and update shipment
 */
router.post('/generate-label', authenticate, checkLabStaff, async (req: Request, res: Response) => {
  try {
    const { shipmentId, weight, weightUnit, service, packageValue, isHazmat, suppliesUsed, hazmatDetails } = req.body;

    if (!shipmentId || !weight || !weightUnit || !service) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get shipment details with hazmat info from samples
    const shipmentResult = await pool.query(
      `SELECT s.*, 
              sam.chemical_name, 
              sam.lot_number,
              sam.un_number,
              sam.hazard_class,
              sam.packing_group,
              sam.proper_shipping_name
       FROM shipments s
       LEFT JOIN samples sam ON s.sample_id = sam.id
       WHERE s.id = $1`,
      [shipmentId]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = shipmentResult.rows[0];

    // Also get hazmat info from shipment_samples for multi-sample shipments
    const samplesResult = await pool.query(
      `SELECT sam.un_number, sam.hazard_class, sam.packing_group, sam.proper_shipping_name, sam.chemical_name
       FROM shipment_samples ss
       JOIN samples sam ON ss.sample_id = sam.id
       WHERE ss.shipment_id = $1`,
      [shipmentId]
    );

    // Determine hazmat details from request or from samples
    let effectiveHazmatDetails = hazmatDetails;
    if (isHazmat && !effectiveHazmatDetails) {
      // Try to get hazmat details from the shipment's samples
      const sampleWithHazmat = samplesResult.rows.find((s: any) => s.un_number || s.hazard_class) || shipment;
      if (sampleWithHazmat.un_number || sampleWithHazmat.hazard_class) {
        effectiveHazmatDetails = {
          unNumber: sampleWithHazmat.un_number,
          properShippingName: sampleWithHazmat.proper_shipping_name || sampleWithHazmat.chemical_name,
          hazardClass: sampleWithHazmat.hazard_class,
          packingGroup: sampleWithHazmat.packing_group,
        };
      }
    }

    // Get lab address
    const fromAddress = {
      street: process.env.LAB_ADDRESS_STREET || '123 Lab Street',
      city: process.env.LAB_ADDRESS_CITY || 'Baton Rouge',
      stateOrProvinceCode: process.env.LAB_ADDRESS_STATE || 'LA',
      postalCode: process.env.LAB_ADDRESS_ZIP || '70802',
      countryCode: 'US',
    };

    const toAddress = {
      street: shipment.destination_address,
      city: shipment.destination_city,
      stateOrProvinceCode: shipment.destination_state,
      postalCode: shipment.destination_zip,
      countryCode: shipment.destination_country || 'US',
    };

    // Generate FedEx label
    const labelResult = await fedexService.generateShipmentLabel({
      fromAddress,
      toAddress,
      weight: parseFloat(weight),
      weightUnit: weightUnit.toUpperCase() as 'LB' | 'KG',
      service: service as any,
      packageValue: parseFloat(packageValue) || 100,
      isHazmat: isHazmat || false,
      hazmatDetails: effectiveHazmatDetails,
    });

    if (labelResult.error) {
      return res.status(500).json({ error: `FedEx label generation failed: ${labelResult.error}` });
    }

    // Save label PDF to file system (use pre-validated directory)
    const labelDir = ALLOWED_LABEL_DIR;
    await fs.mkdir(labelDir, { recursive: true });

    // Sanitize shipmentId to prevent path traversal in filename
    const safeShipmentId = String(shipmentId).replace(/[^a-zA-Z0-9-]/g, '');
    const labelFileName = `label_${safeShipmentId}_${Date.now()}.pdf`;
    const labelPath = path.join(labelDir, labelFileName);

    // Validate path before writing
    if (!isLabelPathSafe(labelPath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }

    // Decode base64 and save
    if (labelResult.label) {
      const labelBuffer = Buffer.from(labelResult.label, 'base64');
      await fs.writeFile(labelPath, labelBuffer);
    }

    // Update shipment with tracking info
    await pool.query(
      `UPDATE shipments
       SET tracking_number = $1,
           fedex_quote_amount = $2,
           shipping_label_path = $3,
           status = 'shipped',
           shipped_date = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [labelResult.trackingNumber, labelResult.cost, `/uploads/shipping-labels/${labelFileName}`, shipmentId]
    );

    // Record supplies used
    if (suppliesUsed && Array.isArray(suppliesUsed)) {
      for (const supply of suppliesUsed) {
        await pool.query(
          `INSERT INTO shipment_supplies_used (shipment_id, supply_id, quantity_used)
           VALUES ($1, $2, $3)
           ON CONFLICT (shipment_id, supply_id) 
           DO UPDATE SET quantity_used = $3`,
          [shipmentId, supply.supply_id, supply.quantity]
        );

        // Update supply inventory
        await pool.query(
          `UPDATE shipping_supplies
           SET count = count - $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [supply.quantity, supply.supply_id]
        );
      }
    }

    // Create hazmat record if applicable
    if (isHazmat) {
      await pool.query(
        `INSERT INTO dangerous_goods_declarations
         (shipment_id, un_number, hazard_class, proper_shipping_name, packing_group)
         SELECT $1, sam.un_number, sam.hazard_class, sam.chemical_name, sam.packing_group
         FROM samples sam
         WHERE sam.id = $2`,
        [shipmentId, shipment.sample_id]
      );
    }

    res.json({
      success: true,
      data: {
        trackingNumber: labelResult.trackingNumber,
        cost: labelResult.cost,
        estimatedDelivery: labelResult.estimatedDelivery,
        labelPath: `/uploads/shipping-labels/${labelFileName}`,
      },
    });
  } catch (error: any) {
    console.error('Error generating label:', error);
    res.status(500).json({
      error: 'Failed to generate shipping label',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/processing/tracking/:trackingNumber
 * Get tracking information for a shipment
 */
router.get('/tracking/:trackingNumber', authenticate, async (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.params;

    const trackingInfo = await fedexService.getTrackingInfo(trackingNumber);

    if (!trackingInfo) {
      return res.status(404).json({ error: 'Tracking information not found' });
    }

    // Update shipment status if delivered
    if (trackingInfo.status === 'delivered') {
      await pool.query(
        `UPDATE shipments
         SET status = 'delivered',
             delivered_date = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE tracking_number = $1 AND status != 'delivered'`,
        [trackingNumber]
      );
    }

    res.json({
      success: true,
      data: trackingInfo,
    });
  } catch (error: any) {
    console.error('Error getting tracking info:', error);
    res.status(500).json({
      error: 'Failed to get tracking information',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
