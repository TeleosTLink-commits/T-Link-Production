import nodemailer from 'nodemailer';
import logger from '../config/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@teleos.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });

    logger.info(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    return false;
  }
};

export const sendCoAExpirationAlert = async (
  recipientEmail: string,
  lotNumber: string,
  productName: string,
  expirationDate: Date,
  daysUntilExpiration: number
) => {
  const subject = `CoA Expiration Alert: ${lotNumber} - ${daysUntilExpiration} Days Remaining`;
  const html = `
    <h2>Certificate of Analysis Expiration Alert</h2>
    <p>This is an automated reminder that a Certificate of Analysis will expire soon.</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; font-weight: bold;">Lot Number:</td>
        <td style="padding: 8px;">${lotNumber}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Product Name:</td>
        <td style="padding: 8px;">${productName}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Expiration Date:</td>
        <td style="padding: 8px;">${new Date(expirationDate).toLocaleDateString()}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Days Until Expiration:</td>
        <td style="padding: 8px; color: red;">${daysUntilExpiration}</td>
      </tr>
    </table>
    <p>Please take appropriate action to renew or replace this certificate before it expires.</p>
    <p style="color: #666; font-size: 12px;">This is an automated message from the T-Link system.</p>
  `;

  return sendEmail({ to: recipientEmail, subject, html });
};

export const sendLowInventoryAlert = async (
  recipientEmail: string,
  sampleId: string,
  sampleName: string,
  currentVolume: number,
  threshold: number,
  unit: string
) => {
  const subject = `Low Inventory Alert: ${sampleId} - ${sampleName}`;
  const html = `
    <h2>Low Inventory Alert</h2>
    <p>A sample has reached its low inventory threshold.</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; font-weight: bold;">Sample ID:</td>
        <td style="padding: 8px;">${sampleId}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Sample Name:</td>
        <td style="padding: 8px;">${sampleName}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Current Volume:</td>
        <td style="padding: 8px; color: orange;">${currentVolume} ${unit}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Threshold:</td>
        <td style="padding: 8px;">${threshold} ${unit}</td>
      </tr>
    </table>
    <p>Please consider restocking this sample to prevent operational disruptions.</p>
    <p style="color: #666; font-size: 12px;">This is an automated message from the T-Link system.</p>
  `;

  return sendEmail({ to: recipientEmail, subject, html });
};

export const sendShipmentRequestNotification = async (
  recipientEmail: string,
  shipmentNumber: string,
  requestedBy: string,
  sampleName: string,
  destination: string
) => {
  const subject = `New Shipment Request: ${shipmentNumber}`;
  const html = `
    <h2>New Shipment Request</h2>
    <p>A new shipment request has been submitted and requires processing.</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; font-weight: bold;">Shipment Number:</td>
        <td style="padding: 8px;">${shipmentNumber}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Requested By:</td>
        <td style="padding: 8px;">${requestedBy}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Sample:</td>
        <td style="padding: 8px;">${sampleName}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Destination:</td>
        <td style="padding: 8px;">${destination}</td>
      </tr>
    </table>
    <p>Please log in to T-Link to review and process this shipment request.</p>
    <p style="color: #666; font-size: 12px;">This is an automated message from the T-Link system.</p>
  `;

  return sendEmail({ to: recipientEmail, subject, html });
};

export const sendLowSupplyStockAlert = async (
  recipientEmail: string,
  supplyName: string,
  currentQuantity: number,
  threshold: number
) => {
  const subject = `Low Stock Alert: ${supplyName}`;
  const html = `
    <h2>Shipping Supply Low Stock Alert</h2>
    <p>A shipping supply has reached its low stock threshold.</p>
    <table style="border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 8px; font-weight: bold;">Supply Name:</td>
        <td style="padding: 8px;">${supplyName}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Current Quantity:</td>
        <td style="padding: 8px; color: orange;">${currentQuantity}</td>
      </tr>
      <tr>
        <td style="padding: 8px; font-weight: bold;">Threshold:</td>
        <td style="padding: 8px;">${threshold}</td>
      </tr>
    </table>
    <p>Please restock this supply to ensure uninterrupted shipping operations.</p>
    <p style="color: #666; font-size: 12px;">This is an automated message from the T-Link system.</p>
  `;

  return sendEmail({ to: recipientEmail, subject, html });
};
