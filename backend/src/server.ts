import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
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

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const BUILD_VERSION = '2.0.0'; // Updated with schema fixes

// Allowed origins for CORS and CSP
const corsOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
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

