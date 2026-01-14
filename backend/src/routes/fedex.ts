import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import fedexService from '../services/fedexService';
import { authenticate } from '../middleware/auth';

const router = Router();

// Create a new database pool for this route file
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tlink_db',
  password: process.env.DB_PASSWORD || 'Ajwa8770',
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

/**
 * POST /api/fedex/validate-address
 * Validate a delivery address using FedEx Address Validation API
 */
router.post('/validate-address', authenticate, async (req: Request, res: Response) => {
  try {
    const { street, city, stateOrProvinceCode, postalCode, countryCode } = req.body;

    // Validate input
    if (!street || !city || !stateOrProvinceCode || !postalCode) {
      return res.status(400).json({
        error: 'Missing required address fields: street, city, stateOrProvinceCode, postalCode',
      });
    }

    // Call FedEx validation service
    const result = await fedexService.validateAddress({
      street,
      city,
      stateOrProvinceCode,
      postalCode,
      countryCode: countryCode || 'US',
    });

    res.json({
      valid: result.valid,
      correctedAddress: result.correctedAddress,
      error: result.error,
    });
  } catch (error: any) {
    console.error('Address validation error:', error);
    res.status(500).json({ error: error.message || 'Address validation failed' });
  }
});

/**
 * POST /api/fedex/generate-label
 * Generate shipping label and calculate cost
 */
router.post('/generate-label', authenticate, async (req: Request, res: Response) => {
  try {
    const {
      shipmentId,
      fromAddress,
      toAddress,
      weight,
      weightUnit = 'LB',
      service = 'GROUND_HOME_DELIVERY',
      isHazmat = false,
    } = req.body;

    // Validate input
    if (!shipmentId) {
      return res.status(400).json({ error: 'Shipment ID is required' });
    }

    if (!fromAddress || !toAddress || !weight) {
      return res.status(400).json({
        error: 'Missing required fields: fromAddress, toAddress, weight',
      });
    }

    // Generate label
    const labelResult = await fedexService.generateShipmentLabel({
      fromAddress,
      toAddress,
      weight,
      weightUnit,
      service,
      packageValue: 0,
      isHazmat,
    });

    if (labelResult.error) {
      return res.status(400).json({ error: labelResult.error });
    }

    // Update shipment with tracking number and label URL
    await pool.query(
      `UPDATE shipments 
       SET tracking_number = $1, fedex_label_url = $2, shipping_cost = $3, estimated_delivery = $4, status = 'shipped'
       WHERE id = $5`,
      [
        labelResult.trackingNumber,
        labelResult.label,
        labelResult.cost,
        labelResult.estimatedDelivery,
        shipmentId,
      ]
    );

    // Create shipment tracking record
    await pool.query(
      `INSERT INTO shipment_tracking (shipment_id, tracking_number, carrier, status, location, timestamp)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [shipmentId, labelResult.trackingNumber, 'fedex', 'shipped', 'Origin', new Date()]
    );

    res.json({
      success: true,
      tracking_number: labelResult.trackingNumber,
      label_url: labelResult.label,
      shipping_cost: labelResult.cost,
      estimated_delivery: labelResult.estimatedDelivery,
    });
  } catch (error: any) {
    console.error('Label generation error:', error);
    res.status(500).json({ error: error.message || 'Label generation failed' });
  }
});

/**
 * POST /api/fedex/get-rate
 * Get shipping rate quote
 */
router.post('/get-rate', authenticate, async (req: Request, res: Response) => {
  try {
    const { fromAddress, toAddress, weight, weightUnit = 'LB', service = 'GROUND_HOME_DELIVERY' } = req.body;

    // Validate input
    if (!fromAddress || !toAddress || !weight) {
      return res.status(400).json({
        error: 'Missing required fields: fromAddress, toAddress, weight',
      });
    }

    // Get rate
    const rateResult = await fedexService.getShippingRate({
      fromAddress,
      toAddress,
      weight,
      weightUnit,
      service,
      packageValue: 0,
    });

    if (rateResult.error) {
      return res.status(400).json({ error: rateResult.error });
    }

    res.json({
      rate: rateResult.rate,
      currency: 'USD',
    });
  } catch (error: any) {
    console.error('Rate calculation error:', error);
    res.status(500).json({ error: error.message || 'Rate calculation failed' });
  }
});

/**
 * GET /api/fedex/tracking/:trackingNumber
 * Get tracking information for a shipment
 */
router.get('/tracking/:trackingNumber', authenticate, async (req: Request, res: Response) => {
  try {
    const { trackingNumber } = req.params;

    if (!trackingNumber) {
      return res.status(400).json({ error: 'Tracking number is required' });
    }

    // Get tracking info
    const trackingInfo = await fedexService.getTrackingInfo(trackingNumber);

    if (!trackingInfo) {
      return res.status(404).json({ error: 'Tracking information not found' });
    }

    res.json(trackingInfo);
  } catch (error: any) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: error.message || 'Failed to get tracking information' });
  }
});

/**
 * POST /api/fedex/update-tracking
 * Manually trigger a tracking update for a shipment
 * (This can be called by a scheduled job or webhook)
 */
router.post('/update-tracking', authenticate, async (req: Request, res: Response) => {
  try {
    const { trackingNumber, shipmentId } = req.body;

    if (!trackingNumber || !shipmentId) {
      return res.status(400).json({ error: 'Tracking number and shipment ID are required' });
    }

    // Get tracking info from FedEx
    const trackingInfo = await fedexService.getTrackingInfo(trackingNumber);

    if (!trackingInfo) {
      return res.status(404).json({ error: 'Tracking information not found' });
    }

    // Check if shipment is delivered
    if (trackingInfo.status === 'delivered') {
      // Update shipment status to delivered
      await pool.query(
        `UPDATE shipments SET status = 'delivered', updated_at = NOW() WHERE id = $1`,
        [shipmentId]
      );

      // Insert tracking record
      await pool.query(
        `INSERT INTO shipment_tracking (shipment_id, tracking_number, carrier, status, location, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (shipment_id, tracking_number, timestamp) DO NOTHING`,
        [shipmentId, trackingNumber, 'fedex', trackingInfo.status, trackingInfo.location]
      );
    }

    res.json({
      success: true,
      status: trackingInfo.status,
      location: trackingInfo.location,
      estimatedDelivery: trackingInfo.estimatedDelivery,
    });
  } catch (error: any) {
    console.error('Tracking update error:', error);
    res.status(500).json({ error: error.message || 'Tracking update failed' });
  }
});

export default router;
