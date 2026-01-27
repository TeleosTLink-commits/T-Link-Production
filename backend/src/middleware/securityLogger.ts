import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { query } from '../config/database';

/**
 * Security Audit Logger
 * Logs security-relevant events for monitoring and incident response
 */

export interface SecurityEvent {
  eventType: 'login_success' | 'login_failure' | 'login_lockout' | 'unauthorized_access' | 
             'rate_limit_exceeded' | 'invalid_token' | 'permission_denied' | 'suspicious_activity';
  userId?: string;
  email?: string;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  method: string;
  details?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Get client IP address (handles proxies)
export const getClientIP = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

// Log security event to console/file
export const logSecurityEvent = (event: SecurityEvent): void => {
  const logMessage = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  // Log based on severity
  switch (event.severity) {
    case 'critical':
      logger.error(`🚨 CRITICAL SECURITY EVENT: ${JSON.stringify(logMessage)}`);
      break;
    case 'high':
      logger.warn(`⚠️ HIGH SECURITY EVENT: ${JSON.stringify(logMessage)}`);
      break;
    case 'medium':
      logger.warn(`🔶 SECURITY EVENT: ${JSON.stringify(logMessage)}`);
      break;
    default:
      logger.info(`🔵 SECURITY EVENT: ${JSON.stringify(logMessage)}`);
  }
};

// Log security event to database (for persistent audit trail)
export const logSecurityEventToDB = async (event: SecurityEvent): Promise<void> => {
  try {
    await query(
      `INSERT INTO security_audit_log 
       (event_type, user_id, email, ip_address, user_agent, endpoint, method, details, severity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        event.eventType,
        event.userId || null,
        event.email || null,
        event.ipAddress,
        event.userAgent,
        event.endpoint,
        event.method,
        event.details || null,
        event.severity,
      ]
    );
  } catch (error) {
    // Don't fail the request if logging fails, but log the error
    logger.error('Failed to log security event to database:', error);
  }
};

// Combined logging function
export const auditLog = async (event: SecurityEvent): Promise<void> => {
  logSecurityEvent(event);
  
  // Only log to DB for medium+ severity events
  if (['medium', 'high', 'critical'].includes(event.severity)) {
    await logSecurityEventToDB(event);
  }
};

// Helper functions for common security events
export const logLoginSuccess = async (req: Request, userId: string, email: string): Promise<void> => {
  await auditLog({
    eventType: 'login_success',
    userId,
    email,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    endpoint: req.path,
    method: req.method,
    severity: 'low',
  });
};

export const logLoginFailure = async (req: Request, email: string, reason: string): Promise<void> => {
  await auditLog({
    eventType: 'login_failure',
    email,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    endpoint: req.path,
    method: req.method,
    details: reason,
    severity: 'medium',
  });
};

export const logAccountLockout = async (req: Request, email: string): Promise<void> => {
  await auditLog({
    eventType: 'login_lockout',
    email,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    endpoint: req.path,
    method: req.method,
    details: 'Account locked due to too many failed login attempts',
    severity: 'high',
  });
};

export const logUnauthorizedAccess = async (req: Request, details?: string): Promise<void> => {
  await auditLog({
    eventType: 'unauthorized_access',
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    endpoint: req.path,
    method: req.method,
    details: details || 'Attempted access without valid authentication',
    severity: 'high',
  });
};

export const logPermissionDenied = async (req: Request, userId: string, requiredRole: string): Promise<void> => {
  await auditLog({
    eventType: 'permission_denied',
    userId,
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    endpoint: req.path,
    method: req.method,
    details: `User attempted action requiring role: ${requiredRole}`,
    severity: 'medium',
  });
};

export const logRateLimitExceeded = async (req: Request): Promise<void> => {
  await auditLog({
    eventType: 'rate_limit_exceeded',
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    endpoint: req.path,
    method: req.method,
    details: 'Rate limit exceeded - possible brute force or DoS attempt',
    severity: 'high',
  });
};

export const logSuspiciousActivity = async (req: Request, details: string): Promise<void> => {
  await auditLog({
    eventType: 'suspicious_activity',
    ipAddress: getClientIP(req),
    userAgent: req.headers['user-agent'] || 'unknown',
    endpoint: req.path,
    method: req.method,
    details,
    severity: 'critical',
  });
};
