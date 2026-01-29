import express, { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import {
  sendShipmentCreatedNotification,
  sendShipmentShippedNotification,
  sendSupportRequestNotification,
} from '../services/emailService';
import { extractDatesFromPDF, updateSampleDates } from '../services/pdfExtractionService';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { pool, query } from '../config/database';
import logger from '../config/logger';

const router: Router = express.Router();

/**
 * Middleware: Check if user is manufacturer
 */
const checkManufacturer = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (user.role !== 'manufacturer') {
    return res.status(403).json({ error: 'Access denied. Manufacturer role required.' });
  }
  next();
};

/**
 * GET /api/manufacturer/coa/search?lot_number=LOT-001
 * Search for Certificate of Analysis by lot number
 * Automatically extracts and updates certification/expiration dates from PDF
 */
router.get('/coa/search', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const { lot_number } = req.query;

    if (!lot_number) {
      return res.status(400).json({ error: 'lot_number query parameter required' });
    }

    // Search for sample with matching lot number
    const result = await query(
      `SELECT id, chemical_name, lot_number, received_date, certification_date, recertification_date, expiration_date, coa_file_path, created_at
       FROM samples 
       WHERE lot_number = $1
       LIMIT 1`,
      [lot_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No sample found with this lot number',
        lot_number,
      });
    }

    const sample = result.rows[0];

    // If PDF exists and dates are missing, attempt to extract them
    if (sample.coa_file_path && (!sample.expiration_date || !sample.certification_date)) {
      try {
        console.log(`Extracting dates from PDF for sample ${sample.id}...`);
        const extractedDates = await extractDatesFromPDF(sample.coa_file_path);
        
        if (extractedDates.certification_date || extractedDates.expiration_date) {
          await updateSampleDates(pool, sample.id, extractedDates);
          
          // Update local sample object with extracted dates
          if (extractedDates.certification_date && !sample.certification_date) {
            sample.certification_date = extractedDates.certification_date;
          }
          if (extractedDates.expiration_date && !sample.expiration_date) {
            sample.expiration_date = extractedDates.expiration_date;
          }
          if (extractedDates.recertification_date && !sample.recertification_date) {
            sample.recertification_date = extractedDates.recertification_date;
          }
          
          console.log(`Successfully extracted and updated dates for sample ${sample.id}`);
        }
      } catch (extractError) {
        console.error(`Failed to extract dates from PDF: ${extractError}`);
        // Continue - don't fail the request if extraction fails
      }
    }

    res.json({
      success: true,
      sample: {
        id: sample.id,
        name: sample.chemical_name,
        lot_number: sample.lot_number,
        created_at: sample.created_at,
        received_date: sample.received_date,
        certification_date: sample.certification_date,
        recertification_date: sample.recertification_date,
        expiration_date: sample.expiration_date,
        file_path: sample.coa_file_path,
      },
    });
  } catch (error: any) {
    console.error('Error searching CoA:', error);
    res.status(500).json({
      error: 'Failed to search CoA',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/manufacturer/coa/download/:sampleId
 * Download Certificate of Analysis PDF
 */
router.get('/coa/download/:sampleId', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const { sampleId } = req.params;

    // Get sample file path
    const result = await query(
      `SELECT chemical_name, lot_number, coa_file_path, coa_file_name 
       FROM samples 
       WHERE id = $1 AND status = 'active'`,
      [sampleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const sample = result.rows[0];
    const filePath = sample.coa_file_path;

    // Check if file exists locally
    if (filePath && filePath.startsWith('C:\\')) {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'CoA file not found on server' });
      }
      return res.download(filePath, `${sample.lot_number}_CoA.pdf`);
    }

    // If Cloudinary URL
    if (filePath && (filePath.startsWith('http://') || filePath.startsWith('https://'))) {
      return res.json({
        success: true,
        download_url: filePath,
        filename: `${sample.lot_number}_CoA.pdf`,
      });
    }

    res.status(404).json({ error: 'CoA not available for download' });
  } catch (error: any) {
    console.error('Error downloading CoA:', error);
    res.status(500).json({
      error: 'Failed to download CoA',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/manufacturer/inventory/samples
 * List all available samples for dropdown selection
 */
router.get('/inventory/samples', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT id, chemical_name, lot_number, cas_number, quantity, status 
      FROM samples 
      WHERE status = 'active' 
        AND quantity IS NOT NULL 
        AND quantity != '' 
        AND quantity != '0'
      ORDER BY chemical_name ASC, lot_number ASC
      LIMIT 500
    `);

    res.json({
      success: true,
      count: result.rows.length,
      samples: result.rows.map((row: any) => ({
        id: row.id,
        chemical_name: row.chemical_name,
        lot_number: row.lot_number,
        cas_number: row.cas_number,
        available_quantity: row.quantity,
        status: row.status,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching samples list:', error);
    res.status(500).json({
      error: 'Failed to fetch samples',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/manufacturer/inventory/search?sample_name=Sample%20XYZ
 * Search for sample availability in inventory
 */
router.get('/inventory/search', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const { sample_name, lot_number } = req.query;

    if (!sample_name && !lot_number) {
      return res.status(400).json({ error: 'Provide sample_name or lot_number to search' });
    }

    let queryText = `
      SELECT id, chemical_name, lot_number, quantity, status 
      FROM samples 
      WHERE 1=1`;

    const params: any[] = [];

    if (sample_name) {
      params.push(`%${sample_name}%`);
      queryText += ` AND chemical_name ILIKE $${params.length}`;
    }

    if (lot_number) {
      params.push(`%${lot_number}%`);
      queryText += ` AND lot_number ILIKE $${params.length}`;
    }

    queryText += ' ORDER BY chemical_name ASC LIMIT 50';

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No samples found matching the search criteria',
        search_term: sample_name || lot_number,
      });
    }

    res.json({
      success: true,
      count: result.rows.length,
      samples: result.rows.map((row: any) => ({
        id: row.id,
        name: row.chemical_name,
        lot_number: row.lot_number,
        available_quantity: row.quantity,
        status: row.status,
      })),
    });
  } catch (error: any) {
    console.error('Error searching inventory:', error);
    res.status(500).json({
      error: 'Failed to search inventory',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/manufacturer/shipments/request
 * Create a new shipment request
 */
router.post('/shipments/request', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = (req as any).user.id;
    const userEmail = (req as any).user.email;
    const {
      first_name,
      last_name,
      delivery_address,
      sample_name,
      lot_number,
      quantity_requested,
      quantity_unit = 'ml',
      scheduled_ship_date,
    } = req.body;

    // Validation
    if (!first_name || !last_name || !delivery_address || !sample_name || !lot_number || !quantity_requested) {
      return res.status(400).json({
        error: 'Missing required fields: first_name, last_name, delivery_address, sample_name, lot_number, quantity_requested',
      });
    }

    // Check if sample exists and get inventory
    const sampleResult = await pool.query('SELECT id, quantity FROM samples WHERE lot_number = $1', [
      lot_number,
    ]);

    if (sampleResult.rows.length === 0) {
      return res.status(404).json({ error: `Sample with lot number ${lot_number} not found` });
    }

    const sample = sampleResult.rows[0];

    // Check if sufficient inventory
    if (sample.quantity < quantity_requested) {
      return res.status(400).json({
        error: 'Insufficient inventory',
        available: sample.quantity,
        requested: quantity_requested,
      });
    }

    await client.query('BEGIN');

    // Create shipment record
    const shipmentId = uuidv4();
    const shipmentNumber = `SHIP-${Date.now()}`;

    // Check if quantity >= 30ml (hazmat rule)
    const isHazmat = quantity_requested >= 30;

    await client.query(
      `INSERT INTO shipments (
        id, shipment_number, status, sample_id, lot_number, amount_shipped, unit,
        recipient_name, destination_address, manufacturer_user_id,
        first_name, last_name, scheduled_ship_date, is_hazmat, requires_dg_declaration,
        requested_by, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
      [
        shipmentId,
        shipmentNumber,
        'initiated',
        sample.id,
        lot_number,
        quantity_requested,
        quantity_unit,
        `${first_name} ${last_name}`,
        delivery_address,
        userId,
        first_name,
        last_name,
        scheduled_ship_date || null,
        isHazmat,
        isHazmat, // Flag DG required if hazmat
        userId,
      ]
    );

    await client.query('COMMIT');

    // Send email notification to manufacturer
    try {
      const emailSent = await sendShipmentCreatedNotification(userEmail, `${first_name} ${last_name}`, {
        shipment_id: shipmentId,
        lot_number,
        sample_name,
        quantity_requested,
        unit: quantity_unit,
        delivery_address,
        scheduled_ship_date: scheduled_ship_date || 'TBD',
      });
      logger.info(`Shipment confirmation email ${emailSent ? 'sent' : 'failed'} to ${userEmail}`);
    } catch (emailError: any) {
      logger.error('Failed to send shipment confirmation email:', emailError.message);
      // Don't fail the request if email fails - shipment was created successfully
    }

    res.status(201).json({
      success: true,
      message: 'Shipment request created successfully',
      shipment: {
        id: shipmentId,
        shipment_number: shipmentNumber,
        status: 'initiated',
        lot_number,
        sample_name,
        quantity_requested,
        unit: quantity_unit,
        delivery_address,
        is_hazmat: isHazmat,
        created_at: new Date(),
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});

    console.error('Error creating shipment request:', error);
    res.status(500).json({
      error: 'Failed to create shipment request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/manufacturer/shipments/request-multiple
 * Create a new shipment request with multiple samples (up to 10)
 */
router.post('/shipments/request-multiple', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const userId = (req as any).user.id;
    const userEmail = (req as any).user.email;
    const {
      first_name,
      last_name,
      recipient_company,
      recipient_phone,
      // Structured address fields
      street_address,
      city,
      state,
      zip_code,
      country,
      // Legacy field (can be auto-constructed if not provided)
      delivery_address,
      // Shipping details
      is_international,
      emergency_contact_phone,
      special_instructions,
      scheduled_ship_date,
      samples,
    } = req.body;

    // Validation - require structured address OR legacy delivery_address
    const hasStructuredAddress = street_address && city && state && zip_code;
    if (!first_name || !last_name || (!hasStructuredAddress && !delivery_address) || !samples || !Array.isArray(samples)) {
      return res.status(400).json({
        error: 'Missing required fields: first_name, last_name, address fields (street_address, city, state, zip_code OR delivery_address), samples (array)',
      });
    }

    // Phone is required for FedEx shipments
    if (!recipient_phone) {
      return res.status(400).json({
        error: 'Recipient phone number is required for shipping',
      });
    }

    if (samples.length === 0 || samples.length > 10) {
      return res.status(400).json({
        error: 'Shipment must contain between 1 and 10 samples',
      });
    }

    // Validate each sample
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample.sample_name || !sample.lot_number || !sample.quantity_requested || !sample.quantity_unit) {
        return res.status(400).json({
          error: `Sample ${i + 1} missing required fields: sample_name, lot_number, quantity_requested, quantity_unit`,
        });
      }
      if (isNaN(parseFloat(sample.quantity_requested))) {
        return res.status(400).json({
          error: `Sample ${i + 1}: quantity_requested must be a valid number`,
        });
      }
    }

    await client.query('BEGIN');

    // Check inventory and collect sample data for all samples
    const sampleData = [];
    let totalQuantity = 0;

    for (const sample of samples) {
      // Query samples table and include hazmat fields
      const sampleResult = await client.query(
        `SELECT id, quantity, chemical_name, un_number, hazard_class, packing_group, proper_shipping_name, hazard_description
         FROM samples WHERE lot_number = $1`,
        [sample.lot_number]
      );

      if (sampleResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ 
          error: `Sample with lot number ${sample.lot_number} not found` 
        });
      }

      const dbSample = sampleResult.rows[0];
      const requestedQty = parseFloat(sample.quantity_requested);

      // Check if sufficient inventory
      if (dbSample.quantity < requestedQty) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Insufficient inventory for lot ${sample.lot_number}`,
          available: dbSample.quantity,
          requested: requestedQty,
        });
      }

      sampleData.push({
        ...sample,
        sample_id: dbSample.id,
        quantity_requested: requestedQty,
        // Use hazmat info from request if provided, otherwise from database
        un_number: sample.un_number || dbSample.un_number,
        hazard_class: sample.hazard_class || dbSample.hazard_class,
        packing_group: sample.packing_group || dbSample.packing_group,
        proper_shipping_name: sample.proper_shipping_name || dbSample.proper_shipping_name,
        hazard_description: sample.hazard_description || dbSample.hazard_description,
      });

      totalQuantity += requestedQty;
    }

    // Create shipment record
    const shipmentId = uuidv4();
    const shipmentNumber = `SHIP-${Date.now()}`;

    // Check if any sample has hazmat info OR total quantity >= 30ml
    const hasHazmatSample = sampleData.some(s => s.un_number);
    const isHazmat = hasHazmatSample || totalQuantity >= 30;

    // Build full address from structured fields or use legacy
    const fullAddress = hasStructuredAddress
      ? `${street_address}, ${city}, ${state} ${zip_code}${country && country !== 'USA' ? `, ${country}` : ''}`
      : delivery_address;

    // Insert main shipment record with structured address fields
    await client.query(
      `INSERT INTO shipments (
        id, shipment_number, status, lot_number, amount_shipped, unit,
        recipient_name, recipient_company, destination_address,
        destination_city, destination_state, destination_zip, destination_country,
        manufacturer_user_id, first_name, last_name, scheduled_ship_date,
        is_hazmat, requires_dg_declaration, special_instructions,
        requested_by, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, NOW())`,
      [
        shipmentId,
        shipmentNumber,
        'initiated',
        sampleData.map(s => s.lot_number).join(', '),
        totalQuantity,
        'ml', // Default unit for multi-sample shipments
        `${first_name} ${last_name}`,
        recipient_company || null,
        fullAddress,
        city || null,
        state || null,
        zip_code || null,
        country || 'USA',
        userId,
        first_name,
        last_name,
        scheduled_ship_date || null,
        isHazmat,
        isHazmat,
        special_instructions || null,
        userId,
      ]
    );

    // Insert shipment_samples records for each sample
    const submittedSamples = [];
    for (const sample of sampleData) {
      const result = await client.query(
        `INSERT INTO shipment_samples (shipment_id, sample_id, quantity_requested, unit)
         VALUES ($1, $2, $3, $4)
         RETURNING id, quantity_requested, unit`,
        [shipmentId, sample.sample_id, sample.quantity_requested, sample.quantity_unit]
      );
      
      submittedSamples.push({
        sample_name: sample.sample_name,
        lot_number: sample.lot_number,
        quantity: result.rows[0].quantity_requested,
        unit: result.rows[0].unit,
      });
    }

    await client.query('COMMIT');

    // Send email notification to manufacturer
    try {
      const emailSent = await sendShipmentCreatedNotification(userEmail, `${first_name} ${last_name}`, {
        shipment_id: shipmentId,
        lot_number: sampleData.map(s => s.lot_number).join(', '),
        sample_name: `${sampleData.length} sample(s)`,
        quantity_requested: totalQuantity,
        unit: 'ml',
        delivery_address: fullAddress,
        scheduled_ship_date: scheduled_ship_date || 'TBD',
      });
      logger.info(`Multi-sample shipment confirmation email ${emailSent ? 'sent' : 'failed'} to ${userEmail}`);
    } catch (emailError: any) {
      logger.error('Failed to send multi-sample shipment confirmation email:', emailError.message);
      // Don't fail the request if email fails - shipment was created successfully
    }

    res.status(201).json({
      success: true,
      message: 'Shipment request created successfully',
      shipment: {
        id: shipmentId,
        shipment_number: shipmentNumber,
        status: 'initiated',
        samples: submittedSamples,
        total_quantity: totalQuantity,
        unit: 'ml',
        delivery_address,
        is_hazmat: isHazmat,
        sample_count: sampleData.length,
        created_at: new Date(),
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});

    logger.error('Error creating multi-sample shipment request', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    res.status(500).json({
      error: 'Failed to create shipment request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/manufacturer/shipments/my-requests
 * Get all shipment requests for current manufacturer
 */
router.get('/shipments/my-requests', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `SELECT id, shipment_number, status, lot_number, amount_shipped, unit,
                        recipient_name, destination_address, carrier, tracking_number,
                        scheduled_ship_date, is_hazmat, created_at, shipped_date, estimated_delivery
                 FROM shipments 
                 WHERE manufacturer_user_id = $1`;

    const params: any[] = [userId];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string) || 50);
    params.push(parseInt(offset as string) || 0);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      shipments: result.rows.map((row: any) => ({
        id: row.id,
        shipment_number: row.shipment_number,
        status: row.status,
        lot_number: row.lot_number,
        quantity: row.amount_shipped,
        unit: row.unit,
        recipient_name: row.recipient_name,
        delivery_address: row.destination_address,
        tracking_number: row.tracking_number,
        carrier: row.carrier,
        is_hazmat: row.is_hazmat,
        created_at: row.created_at,
        shipped_date: row.shipped_date,
        estimated_delivery: row.estimated_delivery,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching shipment requests:', error);
    res.status(500).json({
      error: 'Failed to fetch shipment requests',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/manufacturer/shipments/:shipmentId
 * Get details for a specific shipment
 */
router.get('/shipments/:shipmentId', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { shipmentId } = req.params;

    const result = await pool.query(
      `SELECT * FROM shipments 
       WHERE id = $1 AND manufacturer_user_id = $2`,
      [shipmentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const shipment = result.rows[0];

    res.json({
      success: true,
      shipment: {
        id: shipment.id,
        shipment_number: shipment.shipment_number,
        status: shipment.status,
        lot_number: shipment.lot_number,
        sample_id: shipment.sample_id,
        quantity: shipment.amount_shipped,
        unit: shipment.unit,
        recipient_name: shipment.recipient_name,
        delivery_address: shipment.destination_address,
        scheduled_ship_date: shipment.scheduled_ship_date,
        tracking_number: shipment.tracking_number,
        carrier: shipment.carrier,
        is_hazmat: shipment.is_hazmat,
        requires_dg_declaration: shipment.requires_dg_declaration,
        created_at: shipment.created_at,
        shipped_date: shipment.shipped_date,
        estimated_delivery: shipment.estimated_delivery,
        actual_delivery: shipment.actual_delivery,
      },
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
 * POST /api/manufacturer/support/tech-support
 * Submit a technical support request
 */
router.post('/support/tech-support', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { subject, message } = req.body;
    const userEmail = (req as any).user.email;
    const userName = `${(req as any).user.first_name} ${(req as any).user.last_name}`;

    if (!subject || !message) {
      return res.status(400).json({ error: 'subject and message are required' });
    }

    const supportId = uuidv4();
    const techSupportEmail = process.env.TECH_SUPPORT_EMAIL || 'jhunzie@ajwalabs.com';

    // Insert support request into database
    await pool.query(
      `INSERT INTO support_requests (id, manufacturer_user_id, support_type, subject, message, 
                                     recipient_email, submitted_by_email, submitted_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        supportId,
        userId,
        'tech_support',
        subject,
        message,
        techSupportEmail,
        userEmail,
        userName,
      ]
    );

    // Send email to support team
    await sendSupportRequestNotification('tech_support', userName, userEmail, subject, message);

    res.status(201).json({
      success: true,
      message: 'Technical support request submitted successfully',
      request_id: supportId,
    });
  } catch (error: any) {
    console.error('Error submitting tech support request:', error);
    res.status(500).json({
      error: 'Failed to submit support request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * POST /api/manufacturer/support/lab-support
 * Submit a lab support request
 */
router.post('/support/lab-support', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { subject, message } = req.body;
    const userEmail = (req as any).user.email;
    const userName = `${(req as any).user.first_name} ${(req as any).user.last_name}`;

    if (!subject || !message) {
      return res.status(400).json({ error: 'subject and message are required' });
    }

    const supportId = uuidv4();
    const labSupportEmail = process.env.LAB_SUPPORT_EMAIL || 'eboak@ajwalabs.com';

    // Insert support request into database
    await pool.query(
      `INSERT INTO support_requests (id, manufacturer_user_id, support_type, subject, message, 
                                     recipient_email, submitted_by_email, submitted_by_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        supportId,
        userId,
        'lab_support',
        subject,
        message,
        labSupportEmail,
        userEmail,
        userName,
      ]
    );

    // Send email to support team
    await sendSupportRequestNotification('lab_support', userName, userEmail, subject, message);

    res.status(201).json({
      success: true,
      message: 'Lab support request submitted successfully',
      request_id: supportId,
    });
  } catch (error: any) {
    console.error('Error submitting lab support request:', error);
    res.status(500).json({
      error: 'Failed to submit support request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
