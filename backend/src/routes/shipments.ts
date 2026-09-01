import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query } from '../config/database';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { uploadToCloudinary, uploadBufferToCloudinary } from '../utils/cloudinary';

const router = Router();

// Countries that don't require state/province codes
const COUNTRIES_WITHOUT_STATES = ['NL', 'BE', 'DK', 'FI', 'IE', 'NO', 'PT', 'SE', 'AT', 'SG', 'IL', 'NZ'];

/**
 * Helper function to determine if a country requires state/province
 */
function requiresState(countryCode?: string): boolean {
  if (!countryCode) return true;
  return !COUNTRIES_WITHOUT_STATES.includes(countryCode.toUpperCase());
}

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
              ss.un_box_type as supply_name,
              ss.inner_packing_type as supply_type,
              ss.item_number
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

// Create multi-sample shipment (internal use)
router.post('/multi', authenticate, authorize('admin', 'lab_staff', 'logistics', 'super_admin'), async (req: AuthRequest, res, next) => {
  try {
    // Debug logging
    console.log('[Multi Shipment] Request received', {
      user: req.user?.email,
      role: req.user?.role,
      itemCount: req.body.shipment_items?.length,
    });

    const {
      shipment_items,
      unit,
      recipient_name,
      recipient_company,
      recipient_phone,
      recipient_address,
      recipient_address_2,
      recipient_address_3,
      recipient_city,
      recipient_state,
      recipient_zip,
      recipient_country,
      is_international,
      emergency_contact_phone,
      scheduled_ship_date,
      notes,
    } = req.body;

    // Validation
    if (!shipment_items || !Array.isArray(shipment_items) || shipment_items.length === 0) {
      throw new AppError('shipment_items array is required', 400);
    }

    if (shipment_items.length > 20) {
      throw new AppError('Maximum 20 samples per shipment', 400);
    }

    // State is only required for countries that use states/provinces
    const stateRequired = requiresState(recipient_country);
    
    if (!recipient_name || !recipient_address || !recipient_city || (stateRequired && !recipient_state) || !recipient_zip) {
      const missingFields = [];
      if (!recipient_name) missingFields.push('recipient_name');
      if (!recipient_address) missingFields.push('recipient_address');
      if (!recipient_city) missingFields.push('recipient_city');
      if (stateRequired && !recipient_state) missingFields.push('recipient_state');
      if (!recipient_zip) missingFields.push('recipient_zip');
      throw new AppError(`Missing required recipient address fields: ${missingFields.join(', ')}`, 400);
    }

    if (!recipient_phone) {
      throw new AppError('Recipient phone is required for shipping', 400);
    }

    // Validate each item
    for (let i = 0; i < shipment_items.length; i++) {
      const item = shipment_items[i];
      if (!item.sample_id || !item.amount_shipped) {
        throw new AppError(`Item ${i + 1} missing sample_id or amount_shipped`, 400);
      }
    }

    // Calculate totals and check hazmat
    let totalAmount = 0;
    let hasHazmat = false;
    const sampleData: any[] = [];

    for (const item of shipment_items) {
      // Get sample info from database
      const sampleResult = await query(
        `SELECT id, chemical_name, lot_number, quantity, un_number, hazard_class, packing_group, proper_shipping_name
         FROM samples WHERE id = $1 AND status = 'active'`,
        [item.sample_id]
      );

      if (sampleResult.rows.length === 0) {
        throw new AppError(`Sample ${item.sample_id} not found or not active`, 404);
      }

      const sample = sampleResult.rows[0];
      const amountToShip = parseFloat(item.amount_shipped);

      // Parse current quantity (the stored value may include unit suffixes
      // like "100g" or "2.5 kg", and occasionally multiple components such as
      // "100g + 50g"; sum all numeric parts).
      const quantityMatch = String(sample.quantity ?? '').match(/[\d.]+/g);
      const currentQty = quantityMatch ? quantityMatch.reduce((sum: number, val: string) => sum + parseFloat(val), 0) : 0;

      if (amountToShip > currentQty) {
        throw new AppError(`Insufficient quantity for ${sample.chemical_name}. Available: ${currentQty}, Requested: ${amountToShip}`, 400);
      }

      totalAmount += amountToShip;

      // Check for hazmat
      if (sample.un_number || item.un_number) {
        hasHazmat = true;
      }

      sampleData.push({
        ...item,
        sample,
        amountToShip,
        currentQty,
        remainingQty: currentQty - amountToShip,
      });
    }

    // Generate shipment number
    const shipmentNumber = `SHIP-${Date.now()}`;
    // Handle state for countries that don't require it (empty string -> null -> proper formatting)
    const stateValue = recipient_state && recipient_state.trim() !== '' ? recipient_state : null;
    // Build a street-only, multi-line address. City/state/zip are stored in
    // their own columns, so destination_address holds just the street lines
    // (Line 1 + optional Line 2/3 such as building/floor codes). Newlines are
    // preserved so the FedEx service can emit up to 3 separate street lines.
    const streetAddress = [recipient_address, recipient_address_2, recipient_address_3]
      .map((line: string | undefined) => (line || '').trim())
      .filter((line: string) => line.length > 0)
      .join('\n');
    const isHazmat = hasHazmat || totalAmount >= 30;

    // Create shipment record
    const result = await query(
      `INSERT INTO shipments
       (shipment_number, lot_number, amount_shipped, unit,
        recipient_name, recipient_company, destination_address,
        destination_city, destination_state, destination_zip, destination_country,
        special_instructions, is_hazmat, requires_dg_declaration,
        requested_by, scheduled_ship_date, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'initiated', NOW())
       RETURNING *`,
      [
        shipmentNumber,
        sampleData.map(s => s.sample.lot_number).join(', '),
        totalAmount,
        unit,
        recipient_name,
        recipient_company || null,
        streetAddress,
        recipient_city,
        stateValue,
        recipient_zip,
        recipient_country || 'US',
        notes || null,
        isHazmat,
        isHazmat,
        req.user?.id,
        scheduled_ship_date || null,
      ]
    );

    const shipmentId = result.rows[0].id;

    // Insert shipment_samples records and update inventory
    for (const item of sampleData) {
      // Insert shipment_samples junction record
      await query(
        `INSERT INTO shipment_samples (shipment_id, sample_id, quantity_requested, unit)
         VALUES ($1, $2, $3, $4)`,
        [shipmentId, item.sample.id, item.amountToShip, unit]
      );

      // Update sample quantity
      const newQuantityString = item.remainingQty > 0 ? `${item.remainingQty}${unit}` : '0';
      await query(
        `UPDATE samples SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newQuantityString, item.sample.id]
      );

      // Mark as depleted if quantity is now 0
      if (item.remainingQty <= 0) {
        await query(
          `UPDATE samples SET status = 'depleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [item.sample.id]
        );
      }
    }

    // Create chain of custody entry
    await query(
      `INSERT INTO shipment_chain_of_custody (shipment_id, event_type, performed_by, notes)
       VALUES ($1, 'created', $2, $3)`,
      [shipmentId, req.user?.id, `Multi-sample shipment created with ${sampleData.length} item(s). Total: ${totalAmount}${unit}`]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: `Shipment created with ${sampleData.length} sample(s). Inventory quantities updated.`,
      samples_shipped: sampleData.map(s => ({
        chemical_name: s.sample.chemical_name,
        lot_number: s.sample.lot_number,
        amount_shipped: s.amountToShip,
        remaining: s.remainingQty,
      })),
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
    const { quantity, count, notes } = req.body;
    
    // Accept either 'quantity' (to add) or 'count' (new total)
    const amountToAdd = quantity;
    const newTotal = count;

    if (amountToAdd === undefined && newTotal === undefined) {
      throw new AppError('Either quantity (to add) or count (new total) is required', 400);
    }

    const supplyData = await query('SELECT count FROM shipping_supplies WHERE id = $1', [id]);

    if (supplyData.rows.length === 0) {
      throw new AppError('Supply not found', 404);
    }

    const oldQuantity = supplyData.rows[0].count || 0;
    // If newTotal provided, use that; otherwise add quantity to old
    const newQuantity = newTotal !== undefined ? parseInt(newTotal) : (oldQuantity + parseInt(amountToAdd));

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

// Create new shipping supply
router.post('/supplies', authenticate, authorize('admin', 'logistics'), async (req: AuthRequest, res, next) => {
  try {
    const {
      un_box_type,
      inner_packing_type,
      dot_sp_number,
      item_number,
      purchased_from,
      price_per_unit,
      count,
      notes
    } = req.body;

    if (!un_box_type) {
      throw new AppError('UN Box Type is required', 400);
    }

    const result = await query(
      `INSERT INTO shipping_supplies 
       (un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        un_box_type,
        inner_packing_type || null,
        dot_sp_number || null,
        item_number || null,
        purchased_from || null,
        price_per_unit || null,
        count || 0,
        notes || null
      ]
    );

    res.status(201).json({ 
      success: true, 
      message: 'Supply created successfully', 
      data: result.rows[0] 
    });
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

// ============================================================================
// Custom customs / shipping documents
// ----------------------------------------------------------------------------
// Staff can attach arbitrary documents to a shipment (e.g. import permits,
// certificates, country-specific customs forms) beyond the auto-generated
// Commercial Invoice and Packing List. Files are stored on Cloudinary in
// production and on local disk in development.
// ============================================================================

const DOCUMENT_TYPES = [
  'Commercial Invoice', 'Packing List', 'Certificate of Origin',
  'Import Permit', 'Export License', 'Customs Declaration',
  'Material Safety Data Sheet', 'Dangerous Goods Declaration',
  'Certificate of Analysis', 'Other',
];

const SHIPMENT_DOC_DIR = path.resolve(__dirname, '../../uploads/shipment-documents');

const documentStorage = process.env.NODE_ENV === 'production'
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (_req, _file, cb) => {
        if (!fs.existsSync(SHIPMENT_DOC_DIR)) fs.mkdirSync(SHIPMENT_DOC_DIR, { recursive: true });
        cb(null, SHIPMENT_DOC_DIR);
      },
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
      },
    });

const uploadDocument = multer({
  storage: documentStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const allowedExt = /\.(pdf|doc|docx|xls|xlsx|csv|txt|png|jpg|jpeg)$/i.test(path.extname(file.originalname));
    const allowedMime = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'text/plain',
      'image/png',
      'image/jpeg',
    ].includes(file.mimetype);
    if (allowedExt || allowedMime) cb(null, true);
    else cb(new Error('Only PDF, Word, Excel, CSV, text and image files are allowed'));
  },
});

// List documents attached to a shipment
router.get('/:id/documents', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT d.id, d.shipment_id, d.document_type, d.file_name, d.file_path,
              d.file_size, d.mime_type, d.notes, d.created_at,
              u.first_name || ' ' || u.last_name AS uploaded_by_name
       FROM shipment_custom_documents d
       LEFT JOIN users u ON d.uploaded_by = u.id
       WHERE d.shipment_id = $1
       ORDER BY d.created_at DESC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// Upload/attach a document to a shipment
router.post(
  '/:id/documents',
  authenticate,
  authorize('admin', 'lab_staff', 'logistics', 'super_admin'),
  uploadDocument.single('file'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id } = req.params;
      const file = req.file;
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const documentType = DOCUMENT_TYPES.includes(req.body.document_type)
        ? req.body.document_type
        : 'Other';
      const notes = req.body.notes || null;

      // Confirm the shipment exists
      const shipmentResult = await query('SELECT id FROM shipments WHERE id = $1', [id]);
      if (shipmentResult.rows.length === 0) {
        throw new AppError('Shipment not found', 404);
      }

      // Persist the file (Cloudinary in production, disk path in development)
      const folder = `shipment-documents/${id}`;
      let filePath: string;
      if (process.env.NODE_ENV === 'production') {
        if (!file.buffer) throw new AppError('File buffer unavailable in production', 500);
        const url = await uploadBufferToCloudinary(file.buffer, file.originalname, folder);
        if (!url) throw new AppError('Cloud upload failed', 502);
        filePath = url;
      } else {
        const url = await uploadToCloudinary(file.path, folder).catch(() => null);
        filePath = url || file.path;
      }

      const result = await query(
        `INSERT INTO shipment_custom_documents
         (shipment_id, document_type, file_name, file_path, file_size, mime_type, notes, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, shipment_id, document_type, file_name, file_path, file_size, mime_type, notes, created_at`,
        [id, documentType, file.originalname, filePath, file.size || null, file.mimetype || null, notes, req.user?.id]
      );

      res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

// Download / open a shipment document
router.get('/:id/documents/:docId/download', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { id, docId } = req.params;
    const result = await query(
      `SELECT file_path, file_name, mime_type
       FROM shipment_custom_documents
       WHERE id = $1 AND shipment_id = $2`,
      [docId, id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Document not found', 404);
    }

    const { file_path, file_name, mime_type } = result.rows[0];

    // Cloudinary-hosted file: redirect the client to the stored URL.
    if (/^https?:\/\//i.test(file_path)) {
      return res.redirect(file_path);
    }

    // Local disk file (development): stream it back, guarding against traversal.
    const resolved = path.resolve(file_path);
    if (!resolved.startsWith(SHIPMENT_DOC_DIR)) {
      throw new AppError('Invalid file path', 400);
    }
    if (!fs.existsSync(resolved)) {
      throw new AppError('File not found on disk', 404);
    }
    if (mime_type) res.type(mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${file_name.replace(/["\\]/g, '')}"`);
    return fs.createReadStream(resolved).pipe(res);
  } catch (error) {
    next(error);
  }
});

// Delete a shipment document
router.delete(
  '/:id/documents/:docId',
  authenticate,
  authorize('admin', 'lab_staff', 'logistics', 'super_admin'),
  async (req: AuthRequest, res, next) => {
    try {
      const { id, docId } = req.params;
      const result = await query(
        `DELETE FROM shipment_custom_documents
         WHERE id = $1 AND shipment_id = $2
         RETURNING id, file_path`,
        [docId, id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Document not found', 404);
      }

      // Best-effort local cleanup (development disk files only).
      const filePath = result.rows[0].file_path;
      if (filePath && !/^https?:\/\//i.test(filePath)) {
        const resolved = path.resolve(filePath);
        if (resolved.startsWith(SHIPMENT_DOC_DIR) && fs.existsSync(resolved)) {
          fs.unlink(resolved, () => undefined);
        }
      }

      res.json({ success: true, message: 'Document removed' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
