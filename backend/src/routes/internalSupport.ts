import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import { sendSupportRequestNotification } from '../services/emailService';

const router = Router();

/**
 * POST /api/internal/support/tech-support
 * Submit a technical support request from internal staff
 */
router.post('/support/tech-support', authenticate, async (req: Request, res: Response) => {
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
      `INSERT INTO support_requests (id, user_id, support_type, subject, message, 
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
 * POST /api/internal/support/lab-support
 * Submit a lab support request from internal staff
 */
router.post('/support/lab-support', authenticate, async (req: Request, res: Response) => {
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
      `INSERT INTO support_requests (id, user_id, support_type, subject, message, 
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
