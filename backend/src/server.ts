import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import logger from './config/logger';

// Import routes
import authRoutes from './routes/auth';
import testMethodsRoutes from './routes/testMethods';
import inventoryRoutes from './routes/inventory';
import sampleInventoryRoutes from './routes/sampleInventory';
import shipmentsRoutes from './routes/shipments';
import manufacturerRoutes from './routes/manufacturer';
import manufacturerAuthRoutes from './routes/manufacturerAuth';
import manufacturerPortalRoutes from './routes/manufacturerPortal';
import processingShipmentsRoutes from './routes/processingShipments';
import fedexRoutes from './routes/fedex';
import adminRoutes from './routes/admin';
import internalSupportRoutes from './routes/internalSupport';
import studiesRoutes from './routes/studies';
dotenv.config();

// ============================================================================
// SECURITY: Environment Variable Validation
// ============================================================================
const isProduction = process.env.NODE_ENV === 'production';

// Critical environment variables that MUST be set in production
const requiredProductionEnvVars = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

// Validate JWT_SECRET strength
if (process.env.JWT_SECRET) {
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret.length < 32) {
    if (isProduction) {
      console.error('❌ FATAL SECURITY ERROR: JWT_SECRET must be at least 32 characters in production');
      console.error('   Generate a strong secret: openssl rand -base64 64');
      process.exit(1);
    } else {
      console.warn('⚠️  WARNING: JWT_SECRET is weak (< 32 chars). This is only acceptable in development.');
    }
  }
} else if (isProduction) {
  console.error('❌ FATAL: JWT_SECRET is required in production');
  process.exit(1);
}

// Validate all required environment variables in production
if (isProduction) {
  const missingVars = requiredProductionEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ FATAL SECURITY ERROR: Missing required environment variables in production:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\n   Set these in your Render.com dashboard or deployment environment.');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables validated');
}

const app = express();

// Trust proxy for rate limiting behind reverse proxies (Render, Vercel, etc.)
app.set('trust proxy', 1);

const PORT = parseInt(process.env.PORT || '5000', 10);
const BUILD_VERSION = '2.0.0'; // Updated with schema fixes

// Allowed origins for CORS and CSP
const corsOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://app.teleostlink.com',       // Custom domain
  'https://t-link-production.vercel.app', // Production Vercel
  'https://t-link-l41i.vercel.app',   // Old Vercel project
  'https://t-link-vv3r.vercel.app',   // New Vercel project
  'http://localhost:3000',
  'http://10.0.0.41:3000',             // Network access
];

// Security middleware with enhanced CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: [
        "'self'",
        ...corsOrigins,
        "https://apis.fedex.com",
        "https://apis-sandbox.fedex.com",
        "https://res.cloudinary.com",
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for Cloudinary images
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

logger.info(`CORS origins configured: ${corsOrigins.join(', ')}`);
logger.info(`Build version: ${BUILD_VERSION}`);

// Handle preflight OPTIONS requests explicitly - MUST be before rate limiter
app.options('*', cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

// CORS middleware - MUST be before rate limiter
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

// Rate limiting - after CORS
app.use(apiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================================
// SECURITY: Block XML entity expansion attacks (CVE: GHSA-jmr7-xgp7-cmfj)
// This API only accepts JSON. Reject any request with XML content-type or
// request bodies containing DOCTYPE declarations to prevent entity expansion DoS.
// ============================================================================
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('xml')) {
    return res.status(415).json({ error: 'XML content type is not supported. Use application/json.' });
  }
  // Check raw body for DOCTYPE if somehow passed through
  if (req.body && typeof req.body === 'string' && req.body.includes('<!DOCTYPE')) {
    return res.status(400).json({ error: 'Request body contains prohibited content (DOCTYPE).' });
  }
  next();
});

app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Diagnostic endpoint — shows masked Cloudinary config for production troubleshooting
app.get('/health/cloudinary', (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  res.json({
    cloud_name: cloudName || 'MISSING',
    api_key: apiKey ? `${apiKey.slice(0, 6)}...` : 'MISSING',
    api_secret: apiSecret ? `${apiSecret.slice(0, 4)}...` : 'MISSING',
    all_set: Boolean(cloudName && apiKey && apiSecret),
  });
});

// Diagnostic endpoint — verifies Cloudinary credentials via authenticated API call
app.get('/health/cloudinary/ping', async (req, res) => {
  try {
    const normalizeEnvValue = (value?: string): string => {
      const trimmed = (value || '').trim();
      return trimmed.replace(/^['\"]|['\"]$/g, '');
    };

    const cloudName = normalizeEnvValue(process.env.CLOUDINARY_CLOUD_NAME);
    const apiKey = normalizeEnvValue(process.env.CLOUDINARY_API_KEY);
    const apiSecret = normalizeEnvValue(process.env.CLOUDINARY_API_SECRET);

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const pingResult = await cloudinary.api.ping();
    return res.json({
      ok: true,
      status: pingResult?.status || 'unknown',
      cloud_name: cloudName || 'MISSING',
    });
  } catch (error: any) {
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Cloudinary ping failed',
      http_code: error?.http_code || null,
      error_name: error?.name || null,
      error_message: error?.error?.message || null,
      error_raw: String(error),
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'MISSING',
    });
  }
});

// API Routes
// NOTE: More specific routes must come before less specific ones
app.use('/api/auth/manufacturer', authLimiter, manufacturerAuthRoutes); // Must be before /api/auth
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/test-methods', testMethodsRoutes);
// CoA routes removed — functionality handled via sample-inventory
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sample-inventory', sampleInventoryRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/manufacturer', manufacturerPortalRoutes);
app.use('/api/processing', processingShipmentsRoutes);
app.use('/api/fedex', fedexRoutes);
app.use('/api/manufacturer-admin', manufacturerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/internal', internalSupportRoutes);
app.use('/api/studies', studiesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  logger.info(`T-Link server running on ${HOST}:${PORT}`);
  console.log(`🚀 T-Link server running on http://${HOST}:${PORT}`);
  console.log(`🌐 Network access: http://10.0.0.41:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;

