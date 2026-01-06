import { Router } from 'express';
import { query } from '../config/database';
import { AuthRequest, authenticate, authorize } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// Manufacturer-specific authentication check
const isManufacturer = (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role !== 'manufacturer') {
    return res.status(403).json({ error: 'Access restricted to manufacturers only' });
  }
  next();
};

// Get manufacturer's company info
router.get('/company/info', authenticate, isManufacturer, async (req: AuthRequest, res, next) => {
  try {
    const result = await query(
      `SELECT mc.* 
       FROM manufacturer_companies mc
       JOIN manufacturer_users mu ON mc.id = mu.company_id
       WHERE mu.user_id = $1`,
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Company not found for this manufacturer', 404);
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get reference standards (CoAs) for manufacturer
router.get('/reference-standards', authenticate, isManufacturer, async (req: AuthRequest, res, next) => {
  try {
    const { status, search } = req.query;

    // Get manufacturer's company ID
    const companyResult = await query(
      `SELECT company_id FROM manufacturer_users WHERE user_id = $1`,
      [req.user?.id]
    );

    if (companyResult.rows.length === 0) {
      throw new AppError('No company associated with this user', 404);
    }

    const companyId = companyResult.rows[0].company_id;

    let queryText = `
      SELECT 
        lot_number,
        product_name,
        issue_date,
        expiration_date,
        status,
        (expiration_date - CURRENT_DATE) as days_until_expiration
      FROM certificates_of_analysis
      WHERE manufacturer_id = $1
    `;
    const params: any[] = [companyId];

    if (status) {
      params.push(status);
      queryText += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (lot_number ILIKE $${params.length} OR product_name ILIKE $${params.length})`;
    }

    queryText += ' ORDER BY expiration_date ASC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get specific CoA by lot number (read-only)
router.get('/coa/:lotNumber', authenticate, isManufacturer, async (req: AuthRequest, res, next) => {
  try {
    const { lotNumber } = req.params;

    // Get manufacturer's company ID
    const companyResult = await query(
      `SELECT company_id FROM manufacturer_users WHERE user_id = $1`,
      [req.user?.id]
    );

    if (companyResult.rows.length === 0) {
      throw new AppError('No company associated with this user', 404);
    }

    const companyId = companyResult.rows[0].company_id;

    const result = await query(
      `SELECT 
        id,
        lot_number,
        product_name,
        issue_date,
        expiration_date,
        file_path,
        file_name,
        status
       FROM certificates_of_analysis
       WHERE lot_number = $1 AND manufacturer_id = $2`,
      [lotNumber, companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('CoA not found or access denied', 404);
    }

    // Log audit trail
    await query(
      `INSERT INTO document_audit_log (document_type, document_id, action, performed_by)
       VALUES ('coa', $1, 'viewed', $2)`,
      [result.rows[0].id, req.user?.id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Download CoA file
router.get('/coa/:lotNumber/download', authenticate, isManufacturer, async (req: AuthRequest, res, next) => {
  try {
    const { lotNumber } = req.params;

    // Get manufacturer's company ID
    const companyResult = await query(
      `SELECT company_id FROM manufacturer_users WHERE user_id = $1`,
      [req.user?.id]
    );

    if (companyResult.rows.length === 0) {
      throw new AppError('No company associated with this user', 404);
    }

    const companyId = companyResult.rows[0].company_id;

    const result = await query(
      `SELECT id, file_path, file_name
       FROM certificates_of_analysis
       WHERE lot_number = $1 AND manufacturer_id = $2`,
      [lotNumber, companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('CoA not found or access denied', 404);
    }

    // Log download
    await query(
      `INSERT INTO document_audit_log (document_type, document_id, action, performed_by)
       VALUES ('coa', $1, 'downloaded', $2)`,
      [result.rows[0].id, req.user?.id]
    );

    res.json({
      filePath: result.rows[0].file_path,
      fileName: result.rows[0].file_name,
      message: 'File ready for download',
    });
  } catch (error) {
    next(error);
  }
});

// Get shipments sent to manufacturer's company
router.get('/shipments', authenticate, isManufacturer, async (req: AuthRequest, res, next) => {
  try {
    const { status } = req.query;

    // Get manufacturer's company name
    const companyResult = await query(
      `SELECT mc.company_name 
       FROM manufacturer_companies mc
       JOIN manufacturer_users mu ON mc.id = mu.company_id
       WHERE mu.user_id = $1`,
      [req.user?.id]
    );

    if (companyResult.rows.length === 0) {
      throw new AppError('No company associated with this user', 404);
    }

    const companyName = companyResult.rows[0].company_name;

    let queryText = `
      SELECT 
        shipment_number,
        lot_number,
        amount_shipped,
        unit,
        recipient_name,
        destination_address,
        carrier,
        tracking_number,
        status,
        shipped_date,
        estimated_delivery
      FROM shipments
      WHERE recipient_company = $1
    `;
    const params: any[] = [companyName];

    if (status) {
      params.push(status);
      queryText += ` AND status = $${params.length}`;
    }

    queryText += ' ORDER BY shipped_date DESC';

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get dashboard statistics for manufacturer
router.get('/dashboard/stats', authenticate, isManufacturer, async (req: AuthRequest, res, next) => {
  try {
    // Get manufacturer's company ID
    const companyResult = await query(
      `SELECT company_id FROM manufacturer_users WHERE user_id = $1`,
      [req.user?.id]
    );

    if (companyResult.rows.length === 0) {
      throw new AppError('No company associated with this user', 404);
    }

    const companyId = companyResult.rows[0].company_id;

    // Get CoA statistics
    const coaStats = await query(
      `SELECT 
        COUNT(*) as total_coas,
        COUNT(CASE WHEN status = 'valid' THEN 1 END) as valid_coas,
        COUNT(CASE WHEN status = 'expiring_soon' THEN 1 END) as expiring_soon,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired
       FROM certificates_of_analysis
       WHERE manufacturer_id = $1`,
      [companyId]
    );

    res.json(coaStats.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
