import express, { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { authenticate } from '../middleware/auth';
import {
  sendShipmentCreatedNotification,
  sendShipmentShippedNotification,
  sendSupportRequestNotification,
} from '../services/emailService';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

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
 */
router.get('/coa/search', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const { lot_number } = req.query;

    if (!lot_number) {
      return res.status(400).json({ error: 'lot_number query parameter required' });
    }

    // Search for sample with matching lot number
    const result = await pool.query(
      `SELECT id, sample_name, lot_number, created_at, file_path 
       FROM samples 
       WHERE lot_number = $1 AND is_active = true
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

    res.json({
      success: true,
      sample: {
        id: sample.id,
        name: sample.sample_name,
        lot_number: sample.lot_number,
        created_at: sample.created_at,
        file_path: sample.file_path,
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
    const result = await pool.query(
      `SELECT sample_name, lot_number, file_path 
       FROM samples 
       WHERE id = $1 AND is_active = true`,
      [sampleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const sample = result.rows[0];
    const filePath = sample.file_path;

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
 * GET /api/manufacturer/inventory/search?sample_name=Sample%20XYZ
 * Search for sample availability in inventory
 */
router.get('/inventory/search', authenticate, checkManufacturer, async (req: Request, res: Response) => {
  try {
    const { sample_name } = req.query;

    if (!sample_name) {
      return res.status(400).json({ error: 'sample_name query parameter required' });
    }

    // Search for samples by name (case-insensitive)
    const result = await pool.query(
      `SELECT id, sample_name, lot_number, current_quantity, quantity_unit, status 
       FROM samples 
       WHERE LOWER(sample_name) LIKE LOWER($1) AND is_active = true
       ORDER BY sample_name ASC
       LIMIT 20`,
      [`%${sample_name}%`]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No samples found matching this name',
        search_term: sample_name,
      });
    }

    res.json({
      success: true,
      count: result.rows.length,
      samples: result.rows.map((row: any) => ({
        id: row.id,
        name: row.sample_name,
        lot_number: row.lot_number,
        available_quantity: row.current_quantity,
        unit: row.quantity_unit,
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
    const sampleResult = await pool.query('SELECT id, current_quantity FROM samples WHERE lot_number = $1', [
      lot_number,
    ]);

    if (sampleResult.rows.length === 0) {
      return res.status(404).json({ error: `Sample with lot number ${lot_number} not found` });
    }

    const sample = sampleResult.rows[0];

    // Check if sufficient inventory
    if (sample.current_quantity < quantity_requested) {
      return res.status(400).json({
        error: 'Insufficient inventory',
        available: sample.current_quantity,
        requested: quantity_requested,
      });
    }

    // Get manufacturer company
    const companyResult = await pool.query(
      `SELECT mc.id, mc.company_name FROM manufacturer_users mu
       JOIN manufacturer_companies mc ON mu.company_id = mc.id
       WHERE mu.user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Manufacturer company information not found' });
    }

    const company = companyResult.rows[0];

    await client.query('BEGIN');

    // Create shipment record
    const shipmentId = uuidv4();
    const shipmentNumber = `SHIP-${Date.now()}`;

    // Check if quantity >= 30ml (hazmat rule)
    const isHazmat = quantity_requested >= 30;

    await client.query(
      `INSERT INTO shipments (
        id, shipment_number, status, sample_id, lot_number, amount_shipped, unit,
        recipient_name, destination_address, manufacturer_user_id, company_id,
        first_name, last_name, scheduled_ship_date, is_hazmat, requires_dg_declaration,
        requested_by, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
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
        company.id,
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
    await sendShipmentCreatedNotification(userEmail, `${first_name} ${last_name}`, {
      shipment_id: shipmentId,
      lot_number,
      sample_name,
      quantity_requested,
      unit: quantity_unit,
      delivery_address,
      scheduled_ship_date: scheduled_ship_date || 'TBD',
    });

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
