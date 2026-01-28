import nodemailer from 'nodemailer';
import sanitizeHtmlLib from 'sanitize-html';
import logger from '../config/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Safely strip HTML tags without ReDoS vulnerability
 * Uses iterative approach instead of regex with unbounded quantifiers
 */
const stripHtmlTags = (html: string): string => {
  if (!html || typeof html !== 'string') return '';
  let result = '';
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') {
      inTag = true;
    } else if (html[i] === '>') {
      inTag = false;
    } else if (!inTag) {
      result += html[i];
    }
  }
  return result.replace(/\s+/g, ' ').trim();
};

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
    // Use sanitize-html library for proper XSS protection
    const safeHtml = sanitizeHtmlLib(options.html, {
      allowedTags: sanitizeHtmlLib.defaults.allowedTags.concat(['img', 'style']),
      allowedAttributes: {
        ...sanitizeHtmlLib.defaults.allowedAttributes,
        '*': ['style', 'class'],
        'img': ['src', 'alt', 'width', 'height'],
        'a': ['href', 'target', 'rel']
      },
      allowedSchemes: ['http', 'https', 'mailto']
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@teleos.com',
      to: options.to,
      subject: escapeHtml(options.subject),
      html: safeHtml,
      text: options.text || stripHtmlTags(options.html),
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

export const sendShipmentCreatedNotification = async (
  recipientEmail: string,
  recipientName: string,
  shipmentDetails: {
    shipment_id: string;
    lot_number: string;
    sample_name: string;
    quantity_requested: number;
    unit: string;
    delivery_address: string;
    scheduled_ship_date?: string;
  }
) => {
  const subject = 'Shipment Request Confirmation - T-Link Platform';
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Shipment Request Confirmation</h2>
        <p>Dear ${recipientName},</p>
        <p>You have successfully created a shipment request on the T-Link Platform.</p>
        
        <h3>Request Details:</h3>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Lot Number:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${shipmentDetails.lot_number}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Sample Name:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${shipmentDetails.sample_name}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Quantity Requested:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${shipmentDetails.quantity_requested} ${shipmentDetails.unit || 'ml'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Delivery Address:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${shipmentDetails.delivery_address}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Scheduled Ship Date:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${shipmentDetails.scheduled_ship_date || 'TBD'}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Request ID:</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #007bff; font-weight: bold;">${shipmentDetails.shipment_id}</td>
          </tr>
        </table>
        
        <p>You can view the status of your request at any time in your Manufacturer Portal dashboard.</p>
        
        <p>If you have any questions, please contact our support team:</p>
        <ul>
          <li><strong>Tech Support:</strong> <a href="mailto:jhunzie@ajwalabs.com">jhunzie@ajwalabs.com</a></li>
          <li><strong>Lab Support:</strong> <a href="mailto:eboak@ajwalabs.com">eboak@ajwalabs.com</a></li>
        </ul>
        
        <p>Best regards,<br><strong>T-Link Team</strong></p>
      </body>
    </html>
  `;

  return sendEmail({ to: recipientEmail, subject, html });
};

export const sendShipmentShippedNotification = async (
  recipientEmail: string,
  recipientName: string,
  shipmentDetails: {
    shipment_id: string;
    lot_number: string;
    tracking_number: string;
    carrier: string;
  }
) => {
  const subject = 'Your Shipment Has Been Shipped - T-Link Platform';
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Shipment Shipped</h2>
        <p>Dear ${recipientName},</p>
        <p>Your shipment has been shipped!</p>
        
        <h3>Tracking Information:</h3>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Request ID:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${shipmentDetails.shipment_id}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Tracking Number:</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #007bff; font-weight: bold;">${shipmentDetails.tracking_number}</td>
          </tr>
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Carrier:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${shipmentDetails.carrier}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Lot Number:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${shipmentDetails.lot_number}</td>
          </tr>
        </table>
        
        <p>You can track your shipment using the tracking number above on the carrier's website.</p>
        
        <p>Check your portal for the latest status updates.</p>
        
        <p>Best regards,<br><strong>T-Link Team</strong></p>
      </body>
    </html>
  `;

  return sendEmail({ to: recipientEmail, subject, html });
};

export const sendSupportRequestNotification = async (
  supportType: string,
  senderName: string,
  senderEmail: string,
  subject: string,
  message: string
) => {
  const recipientEmail = supportType === 'tech_support' ? (process.env.TECH_SUPPORT_EMAIL || 'jhunzie@ajwalabs.com') : (process.env.LAB_SUPPORT_EMAIL || 'eboak@ajwalabs.com');
  const typeLabel = supportType === 'tech_support' ? 'TECH SUPPORT' : 'LAB SUPPORT';

  const emailSubject = `[${typeLabel}] ${subject}`;
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>${typeLabel} Request</h2>
        
        <h3>Sender Information:</h3>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Name:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${senderName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Email:</td>
            <td style="padding: 10px; border: 1px solid #ddd;"><a href="mailto:${senderEmail}">${senderEmail}</a></td>
          </tr>
        </table>
        
        <h3>Subject:</h3>
        <p style="font-weight: bold; font-size: 16px;">${subject}</p>
        
        <h3>Message:</h3>
        <p style="white-space: pre-wrap; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #007bff;">${escapeHtml(message)}</p>
        
        <p style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px; color: #666;">
          <small>Please reply to ${senderEmail} or use the T-Link Portal to respond.</small>
        </p>
      </body>
    </html>
  `;

  // Send to support team
  await sendEmail({ to: recipientEmail, subject: emailSubject, html });
  
  // Send confirmation copy to manufacturer at their registered email
  const manufacturerHtml = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #333;">
        <h2>Support Request Confirmation</h2>
        <p>Dear ${senderName},</p>
        
        <p>Thank you for submitting a support request. We have received your ${typeLabel.toLowerCase()} request and will respond as soon as possible.</p>
        
        <h3>Request Details:</h3>
        <table style="border-collapse: collapse; margin: 20px 0;">
          <tr style="background-color: #f5f5f5;">
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Request Type:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${typeLabel}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; border: 1px solid #ddd;">Subject:</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${subject}</td>
          </tr>
        </table>
        
        <h3>Your Message:</h3>
        <p style="white-space: pre-wrap; background-color: #f9f9f9; padding: 15px; border-left: 4px solid #28a745;">${escapeHtml(message)}</p>
        
        <p style="margin-top: 20px; color: #666;">
          <strong>Expected Response Time:</strong> 24-48 business hours
        </p>
        
        <p style="margin-top: 30px; border-top: 1px solid #ccc; padding-top: 20px; color: #666;">
          <small>This is an automated confirmation email. Please do not reply to this email. Use the T-Link Portal to track your request status.</small>
        </p>
      </body>
    </html>
  `;
  
  return sendEmail({ to: senderEmail, subject: `Confirmation: ${emailSubject}`, html: manufacturerHtml });
};

/**
 * Send registration invitation email when admin authorizes a new user
 */
export const sendRegistrationInvitation = async (
  email: string,
  role: string
): Promise<boolean> => {
  const roleDisplayName = role.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const baseUrl = process.env.FRONTEND_URL || 'https://t-link-production.vercel.app';
  
  // Determine the correct registration URL based on role
  const registrationUrl = role === 'manufacturer' 
    ? `${baseUrl}/manufacturer/signup`
    : `${baseUrl}/register`;

  const subject = `You're Invited to Join T-Link - Teleos Logistics Platform`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #1a4d2e 0%, #2d5016 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .header img { max-width: 200px; }
          .header h1 { color: white; margin: 20px 0 0; font-size: 24px; }
          .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
          .role-badge { display: inline-block; background: #1a4d2e; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
          .button { display: inline-block; background: #1a4d2e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .button:hover { background: #2d5016; }
          .footer { background: #eee; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
          .steps { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .steps ol { margin: 0; padding-left: 20px; }
          .steps li { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to T-Link</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Teleos Logistics and Information Network</p>
          </div>
          
          <div class="content">
            <p>Hello,</p>
            
            <p>You have been authorized to create an account on <strong>T-Link</strong>, the Teleos/Ajwa Labs logistics and information management platform.</p>
            
            <p>Your authorized role: <span class="role-badge">${roleDisplayName}</span></p>
            
            <div class="steps">
              <h3 style="margin-top: 0;">How to Complete Your Registration:</h3>
              <ol>
                <li>Click the registration button below</li>
                <li>Enter your email address: <strong>${email}</strong></li>
                <li>Create a secure password (minimum 8 characters)</li>
                <li>Fill in your personal/company information</li>
                <li>Submit to create your account</li>
              </ol>
            </div>
            
            <div style="text-align: center;">
              <a href="${registrationUrl}" class="button">Complete Your Registration</a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              <strong>Important:</strong> You must use the email address <strong>${email}</strong> when registering, as this is the only authorized email for your account.
            </p>
            
            <p>If you did not expect this invitation or have questions, please contact Ajwa Labs support.</p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from T-Link. Please do not reply to this email.</p>
            <p>© ${new Date().getFullYear()} Teleos / Ajwa Labs. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const result = await sendEmail({ to: email, subject, html });
    if (result) {
      logger.info(`Registration invitation sent to ${email} for role: ${role}`);
    }
    return result;
  } catch (error) {
    logger.error(`Failed to send registration invitation to ${email}:`, error);
    return false;
  }
};

interface FileShareEmailOptions {
  to: string;
  recipientName: string;
  subject: string;
  message: string;
  attachment: {
    filename: string;
    content: Buffer;
  };
  senderName: string;
}

export const sendFileShareEmail = async (options: FileShareEmailOptions): Promise<{ success: boolean; error?: string }> => {
  const { to, recipientName, subject, message, attachment, senderName } = options;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">T-Link</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Sample Management System</p>
      </div>
      
      <div style="padding: 30px; background: #f9fafb;">
        <p style="color: #374151; margin-top: 0;">Hello ${escapeHtml(recipientName)},</p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #374151; white-space: pre-wrap; margin: 0;">${escapeHtml(message)}</p>
        </div>
        
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border: 1px solid #bbf7d0;">
          <p style="color: #166534; margin: 0; font-size: 14px;">
            📎 <strong>Attached File:</strong> ${escapeHtml(attachment.filename)}
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        
        <p style="color: #6b7280; font-size: 13px; margin: 0;">
          This email was sent by ${escapeHtml(senderName)} via T-Link Sample Management System.
        </p>
      </div>
      
      <div style="background: #1e40af; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="color: white; margin: 0; font-size: 14px;">© 2026 Ajwa Labs</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@ajwalabs.com',
      to,
      subject: `[T-Link] ${escapeHtml(subject)}`,
      html,
      text: `Hello ${recipientName},\n\n${message}\n\nAttached: ${attachment.filename}\n\nSent via T-Link Sample Management System`,
      attachments: [
        {
          filename: attachment.filename,
          content: attachment.content
        }
      ]
    });

    logger.info(`File share email sent to ${to} with attachment: ${attachment.filename}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`Failed to send file share email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

interface ReviewSubmissionEmailOptions {
  to: string;
  subject: string;
  reviewerName: string;
  reviewerEmail: string;
  reviewData: {
    reviewDate?: string;
    browserUsed?: string;
    tasks?: Record<string, string>;
    ratings?: Record<string, string>;
    bugsFound?: string;
    suggestions?: string;
  };
  formattedBody: string;
  summary: {
    passCount: number;
    failCount: number;
    avgRating: string;
  };
}

export const sendReviewSubmissionEmail = async (options: ReviewSubmissionEmailOptions): Promise<{ success: boolean; error?: string }> => {
  const { to, subject, reviewerName, reviewerEmail, reviewData, formattedBody, summary } = options;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0;">T-Link Quick Review</h1>
        <p style="color: rgba(255,255,255,0.9); margin-top: 10px;">Submitted on ${escapeHtml(reviewData.reviewDate || new Date().toLocaleDateString())}</p>
      </div>
      
      <div style="padding: 30px; background: #f9fafb;">
        <!-- Reviewer Info -->
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1e40af; margin-top: 0; font-size: 18px;">Reviewer Information</h2>
          <p><strong>Name:</strong> ${escapeHtml(reviewerName)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(reviewerEmail)}">${escapeHtml(reviewerEmail)}</a></p>
          <p><strong>Browser:</strong> ${escapeHtml(reviewData.browserUsed || 'Not specified')}</p>
        </div>

        <!-- Summary -->
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1e40af; margin-top: 0; font-size: 18px;">Summary</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="text-align: center; padding: 15px; background: #d1fae5; border-radius: 8px; width: 33%;">
                <div style="font-size: 32px; font-weight: bold; color: #059669;">${summary.passCount}</div>
                <div style="color: #065f46;">Passed</div>
              </td>
              <td style="width: 10px;"></td>
              <td style="text-align: center; padding: 15px; background: #fee2e2; border-radius: 8px; width: 33%;">
                <div style="font-size: 32px; font-weight: bold; color: #dc2626;">${summary.failCount}</div>
                <div style="color: #991b1b;">Failed</div>
              </td>
              <td style="width: 10px;"></td>
              <td style="text-align: center; padding: 15px; background: #fef3c7; border-radius: 8px; width: 33%;">
                <div style="font-size: 32px; font-weight: bold; color: #d97706;">⭐ ${escapeHtml(summary.avgRating)}</div>
                <div style="color: #92400e;">Avg Rating</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- Detailed Results -->
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1e40af; margin-top: 0; font-size: 18px;">Detailed Results</h2>
          <pre style="white-space: pre-wrap; font-family: monospace; font-size: 13px; background: #f3f4f6; padding: 15px; border-radius: 6px; overflow-x: auto;">${escapeHtml(formattedBody)}</pre>
        </div>

        ${reviewData.bugsFound ? `
        <!-- Bugs Found -->
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #fecaca;">
          <h2 style="color: #dc2626; margin-top: 0; font-size: 18px;">🐛 Bugs/Issues Reported</h2>
          <p style="white-space: pre-wrap;">${escapeHtml(reviewData.bugsFound)}</p>
        </div>
        ` : ''}

        ${reviewData.suggestions ? `
        <!-- Suggestions -->
        <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #bfdbfe;">
          <h2 style="color: #1e40af; margin-top: 0; font-size: 18px;">💡 Suggestions</h2>
          <p style="white-space: pre-wrap;">${escapeHtml(reviewData.suggestions)}</p>
        </div>
        ` : ''}
      </div>

      <div style="text-align: center; padding: 20px; background: #1e40af; color: white; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; font-size: 14px;">T-Link Sample Management System</p>
        <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.8;">© 2026 Ajwa Labs</p>
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@ajwalabs.com',
      to,
      replyTo: reviewerEmail,
      subject: escapeHtml(subject),
      html,
      text: formattedBody
    });

    logger.info(`Review submission email sent to ${to} from ${reviewerEmail}`);
    return { success: true };
  } catch (error: any) {
    logger.error(`Failed to send review submission email:`, error);
    return { success: false, error: error.message };
  }
};

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
