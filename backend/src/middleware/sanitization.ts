import { Request, Response, NextFunction } from 'express';

/**
 * Sanitize string by escaping HTML special characters
 * More secure approach: escape everything instead of trying to remove tags
 */
function sanitizeString(value: any): any {
  if (typeof value === 'string') {
    // Escape all HTML special characters to prevent XSS
    const sanitized = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
    
    return sanitized.trim();
  }
  return value;
}

/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return sanitizeString(obj);
}

/**
 * Middleware to sanitize request body, query, and params
 * Helps prevent XSS attacks by cleaning user input
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * Whitelist-based sanitization for specific fields
 * Only allows alphanumeric and specified safe characters
 */
export const sanitizeAlphanumeric = (field: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[field];
    if (value && typeof value === 'string') {
      // Allow only letters, numbers, spaces, and basic punctuation
      req.body[field] = value.replace(/[^a-zA-Z0-9\s\-_.@]/g, '').trim();
    }
    next();
  };
};
