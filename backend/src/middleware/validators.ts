import { body, param, query, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Validation middleware for T-Link API endpoints
 * Prevents SQL injection, XSS, and malformed data
 */

// Handle validation errors
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: 'path' in err ? err.path : 'unknown',
        message: err.msg
      }))
    });
  }
  next();
};

// ============ AUTH VALIDATORS ============

export const loginValidator = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 1, max: 128 })
    .withMessage('Password is required and must be under 128 characters'),
  handleValidationErrors
];

export const registerValidator = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('first_name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be under 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),
  body('last_name')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be under 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
  handleValidationErrors
];

// ============ SAMPLE VALIDATORS ============

export const sampleIdValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Sample ID must be a positive integer'),
  handleValidationErrors
];

export const createSampleValidator = [
  body('sample_id')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Sample ID must be under 50 characters'),
  body('sample_type')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Sample type must be under 100 characters'),
  body('manufacturer_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Manufacturer ID must be a positive integer'),
  handleValidationErrors
];

// ============ SHIPMENT VALIDATORS ============

export const shipmentIdValidator = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Shipment ID must be a positive integer'),
  handleValidationErrors
];

export const createShipmentValidator = [
  body('recipient_name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Recipient name is required and must be under 100 characters'),
  body('recipient_address')
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage('Recipient address is required and must be under 255 characters'),
  body('recipient_city')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Recipient city is required'),
  body('recipient_state')
    .trim()
    .isLength({ min: 2, max: 2 })
    .withMessage('State must be a 2-letter code'),
  body('recipient_zip')
    .trim()
    .matches(/^\d{5}(-\d{4})?$/)
    .withMessage('ZIP code must be in format 12345 or 12345-6789'),
  body('recipient_phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\(\)\.+]+$/)
    .withMessage('Phone number contains invalid characters'),
  handleValidationErrors
];

// ============ SEARCH/FILTER VALIDATORS ============

export const searchValidator = [
  query('q')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Search query must be under 200 characters')
    .escape(), // Escape HTML entities
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage('Page must be between 1 and 10000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// ============ FILE UPLOAD VALIDATORS ============

export const fileUploadValidator = [
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be under 500 characters')
    .escape(),
  handleValidationErrors
];

// ============ ADMIN VALIDATORS ============

export const userIdValidator = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  handleValidationErrors
];

export const updateUserValidator = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('role')
    .optional()
    .isIn(['admin', 'super_admin', 'lab_staff', 'viewer', 'manufacturer'])
    .withMessage('Invalid role'),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
  handleValidationErrors
];

// ============ SANITIZER HELPERS ============

/**
 * HTML entity encoding map for XSS prevention
 */
const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Sanitize a string to prevent XSS using HTML entity encoding
 * This is a secure approach that encodes dangerous characters rather than removing them
 */
export const sanitizeString = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char)
    .trim();
};

/**
 * Validate and sanitize an ID parameter
 */
export const sanitizeId = (id: any): number | null => {
  const parsed = parseInt(id, 10);
  if (isNaN(parsed) || parsed < 1) return null;
  return parsed;
};
