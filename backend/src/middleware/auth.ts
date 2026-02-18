import jwt, { SignOptions } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Fail-safe: Require JWT_SECRET in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET must be set and at least 32 characters in production');
  }
  console.warn('⚠️ WARNING: Using insecure default JWT_SECRET. Set JWT_SECRET environment variable.');
}
const SECRET = JWT_SECRET || 'dev-only-insecure-secret-key-32chars';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
  body: any;
  params: any;
  query: any;
  headers: any;
  file?: any;
}

export const generateToken = (payload: any): string => {
  return jwt.sign(payload, SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  } as SignOptions);
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, SECRET);
  } catch (error) {
    return null;
  }
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Try to get token from Authorization header first
    let token: string | null = null;
    const authHeader = req.headers.authorization;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    // Fall back to query parameter (for file downloads via window.open)
    else if (req.query && req.query.token != null) {
      const queryToken = req.query.token as unknown;
      if (typeof queryToken === 'string') {
        token = queryToken;
      } else if (Array.isArray(queryToken) && queryToken.length > 0 && typeof queryToken[0] === 'string') {
        // If multiple tokens are provided, use the first one
        token = queryToken[0];
      } else {
        // Unsupported token type
        console.error('[Auth] Invalid token type in query', {
          url: req.url,
          method: req.method,
          tokenType: typeof queryToken,
        });
        return res.status(400).json({ error: 'Invalid token parameter' });
      }
    }

    // Debug logging for troubleshooting
    if (!token) {
      console.error('[Auth] No token provided', {
        url: req.url,
        method: req.method,
        authHeader: authHeader || 'missing',
        hasQueryToken: !!req.query?.token,
        headers: Object.keys(req.headers),
      });
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      console.error('[Auth] Invalid token', {
        url: req.url,
        tokenLength: token.length,
      });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};
