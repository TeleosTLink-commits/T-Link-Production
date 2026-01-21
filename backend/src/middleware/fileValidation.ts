import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { AppError } from './errorHandler';

/**
 * Allowed file types for uploads
 */
export const ALLOWED_FILE_TYPES = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  documents: ['.pdf', '.doc', '.docx', '.txt'],
  spreadsheets: ['.xls', '.xlsx', '.csv'],
  all: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.csv'],
};

/**
 * Maximum file size in bytes
 * Default: 10MB (10 * 1024 * 1024 = 10485760 bytes)
 * Can be configured via MAX_FILE_SIZE environment variable
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || String(DEFAULT_MAX_FILE_SIZE), 10);

/**
 * Validate uploaded file type and size
 */
export const validateFileUpload = (allowedTypes: string[] = ALLOWED_FILE_TYPES.all) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if file exists
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

    for (const file of files) {
      if (!file) continue;

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new AppError(
          `File ${file.originalname} is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          400
        );
      }

      // Validate file extension
      const fileExt = path.extname(file.originalname).toLowerCase();
      if (!allowedTypes.includes(fileExt)) {
        throw new AppError(
          `File type ${fileExt} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
          400
        );
      }

      // Validate MIME type matches extension
      const mimeTypeMap: { [key: string]: string[] } = {
        '.jpg': ['image/jpeg'],
        '.jpeg': ['image/jpeg'],
        '.png': ['image/png'],
        '.gif': ['image/gif'],
        '.webp': ['image/webp'],
        '.pdf': ['application/pdf'],
        '.doc': ['application/msword'],
        '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        '.txt': ['text/plain'],
        '.xls': ['application/vnd.ms-excel'],
        '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        '.csv': ['text/csv', 'application/vnd.ms-excel'],
      };

      const expectedMimeTypes = mimeTypeMap[fileExt];
      if (expectedMimeTypes && !expectedMimeTypes.includes(file.mimetype)) {
        throw new AppError(
          `File ${file.originalname} has invalid MIME type. Expected ${expectedMimeTypes.join(' or ')}, got ${file.mimetype}`,
          400
        );
      }

      // Sanitize filename - remove dangerous characters
      const sanitizedFilename = file.originalname
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_');
      
      if (file.originalname !== sanitizedFilename) {
        file.originalname = sanitizedFilename;
      }
    }

    next();
  };
};

/**
 * Middleware specifically for image uploads
 */
export const validateImageUpload = validateFileUpload(ALLOWED_FILE_TYPES.images);

/**
 * Middleware specifically for document uploads
 */
export const validateDocumentUpload = validateFileUpload(ALLOWED_FILE_TYPES.documents);
