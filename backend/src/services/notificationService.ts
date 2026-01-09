import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { query } from '../config/database';
import logger from '../config/logger';

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Send email notification
export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    logger.error('Email sending failed:', error);
    throw error;
  }
};

// Check for expiring CoAs and send notifications
export const checkExpiringCoAs = async () => {
  try {
    logger.info('Running CoA expiration check...');

    const warningDays = process.env.EXPIRATION_WARNING_DAYS?.split(',').map(d => parseInt(d)) || [30, 60, 90];

    for (const days of warningDays) {
      const result = await query(
        `SELECT coa.*, mc.company_name, mc.contact_email
         FROM certificates_of_analysis coa
         LEFT JOIN manufacturer_companies mc ON coa.manufacturer_id = mc.id
         WHERE coa.expiration_date = CURRENT_DATE + INTERVAL '${days} days'
           AND coa.status != 'expired'
           AND NOT EXISTS (
             SELECT 1 FROM coa_expiration_notifications
             WHERE coa_id = coa.id 
             AND notification_type = '${days}_days'
             AND sent_at > CURRENT_DATE - INTERVAL '7 days'
           )`
      );

      for (const coa of result.rows) {
        const subject = `CoA Expiration Alert: ${coa.lot_number} - ${days} Days`;
        const html = `
          <h2>Certificate of Analysis Expiration Warning</h2>
          <p>The following Certificate of Analysis will expire in <strong>${days} days</strong>:</p>
          <ul>
            <li><strong>Lot Number:</strong> ${coa.lot_number}</li>
            <li><strong>Product:</strong> ${coa.product_name}</li>
            <li><strong>Manufacturer:</strong> ${coa.company_name}</li>
            <li><strong>Expiration Date:</strong> ${coa.expiration_date}</li>
          </ul>
          <p>Please take necessary action to obtain a new certificate before expiration.</p>
        `;

        // Send to lab team
        await sendEmail(process.env.SMTP_USER || 'lab@teleos.com', subject, html);

        // Send to manufacturer if email exists
        if (coa.contact_email) {
          await sendEmail(coa.contact_email, subject, html);
        }

        // Log notification
        await query(
          `INSERT INTO coa_expiration_notifications (coa_id, notification_type, sent_to, status)
           VALUES ($1, $2, $3, 'sent')`,
          [coa.id, `${days}_days`, coa.contact_email || process.env.SMTP_USER]
        );

        // Create in-app notification
        await query(
          `INSERT INTO notifications (notification_type, subject, message, recipient_email, sent_via, status, related_entity_type, related_entity_id)
           VALUES ('coa_expiration', $1, $2, $3, 'both', 'sent', 'coa', $4)`,
          [subject, html, process.env.SMTP_USER, coa.id]
        );
      }

      logger.info(`Sent ${result.rows.length} CoA expiration notifications for ${days} days`);
    }
  } catch (error) {
    logger.error('Error checking expiring CoAs:', error);
  }
};

// Check for low inventory and send alerts
export const checkLowInventory = async () => {
  try {
    logger.info('Running low inventory check...');

    const result = await query(
      `SELECT s.*, f.freezer_name
       FROM samples s
       LEFT JOIN freezers f ON s.freezer_id = f.id
       WHERE s.current_volume <= s.low_inventory_threshold
         AND s.status = 'low'
         AND NOT EXISTS (
           SELECT 1 FROM inventory_alerts
           WHERE sample_id = s.id 
           AND alert_type = 'low_inventory'
           AND is_resolved = false
         )`
    );

    for (const sample of result.rows) {
      const subject = `Low Inventory Alert: ${sample.sample_name}`;
      const html = `
        <h2>Low Inventory Alert</h2>
        <p>The following sample has reached its low inventory threshold:</p>
        <ul>
          <li><strong>Sample ID:</strong> ${sample.sample_id}</li>
          <li><strong>Sample Name:</strong> ${sample.sample_name}</li>
          <li><strong>Current Volume:</strong> ${sample.current_volume} ${sample.unit}</li>
          <li><strong>Threshold:</strong> ${sample.low_inventory_threshold} ${sample.unit}</li>
          <li><strong>Location:</strong> ${sample.freezer_name}</li>
        </ul>
        <p>Please reorder or restock as soon as possible.</p>
      `;

      await sendEmail(process.env.SMTP_USER || 'lab@teleos.com', subject, html);

      // Create alert record
      await query(
        `INSERT INTO inventory_alerts (sample_id, alert_type, alert_message, current_volume, threshold_volume)
         VALUES ($1, 'low_inventory', $2, $3, $4)`,
        [sample.id, `Sample ${sample.sample_name} has reached low inventory threshold`, sample.current_volume, sample.low_inventory_threshold]
      );

      // Create in-app notification
      await query(
        `INSERT INTO notifications (notification_type, subject, message, recipient_email, sent_via, status, related_entity_type, related_entity_id)
         VALUES ('low_inventory', $1, $2, $3, 'both', 'sent', 'sample', $4)`,
        [subject, html, process.env.SMTP_USER, sample.id]
      );
    }

    logger.info(`Sent ${result.rows.length} low inventory alerts`);
  } catch (error) {
    logger.error('Error checking low inventory:', error);
  }
};

// Check for low shipping supplies
export const checkLowSupplies = async () => {
  try {
    logger.info('Running low supply check...');

    const result = await query(
      `SELECT * FROM shipping_supplies
       WHERE current_quantity <= low_stock_threshold
         AND status IN ('low_stock', 'out_of_stock')`
    );

    if (result.rows.length > 0) {
      const subject = `Low Shipping Supply Alert - ${result.rows.length} Items`;
      let html = `
        <h2>Low Shipping Supply Alert</h2>
        <p>The following shipping supplies are running low:</p>
        <table border="1" cellpadding="5" cellspacing="0">
          <tr>
            <th>Supply Name</th>
            <th>Type</th>
            <th>Current Quantity</th>
            <th>Threshold</th>
            <th>Status</th>
          </tr>
      `;

      result.rows.forEach(supply => {
        html += `
          <tr>
            <td>${supply.supply_name}</td>
            <td>${supply.supply_type}</td>
            <td>${supply.current_quantity}</td>
            <td>${supply.low_stock_threshold}</td>
            <td>${supply.status}</td>
          </tr>
        `;
      });

      html += `
        </table>
        <p>Please restock these supplies to ensure smooth shipping operations.</p>
      `;

      await sendEmail(process.env.SHIPMENT_NOTIFICATION_EMAIL || 'logistics@teleos.com', subject, html);

      logger.info(`Sent low supply alert for ${result.rows.length} items`);
    }
  } catch (error) {
    logger.error('Error checking low supplies:', error);
  }
};

// Initialize scheduled jobs
export const initializeScheduler = () => {
  // Check for expiring CoAs daily at 8:00 AM
  cron.schedule('0 8 * * *', checkExpiringCoAs);
  logger.info('Scheduled: CoA expiration check at 8:00 AM daily');

  // Check for low inventory daily at 9:00 AM
  cron.schedule('0 9 * * *', checkLowInventory);
  logger.info('Scheduled: Low inventory check at 9:00 AM daily');

  // Check for low supplies daily at 10:00 AM
  cron.schedule('0 10 * * *', checkLowSupplies);
  logger.info('Scheduled: Low supply check at 10:00 AM daily');

  logger.info('All scheduled jobs initialized');
};
