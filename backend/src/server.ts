import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import logger from './config/logger';

// Import routes
import authRoutes from './routes/auth';
import testMethodsRoutes from './routes/testMethods';
import coaRoutes from './routes/coa';
import inventoryRoutes from './routes/inventory';
import sampleInventoryRoutes from './routes/sampleInventory';
import shipmentsRoutes from './routes/shipments';
import manufacturerRoutes from './routes/manufacturer';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const BUILD_VERSION = '2.0.0'; // Updated with schema fixes

// Middleware
app.use(helmet());
const corsOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://t-link-production.vercel.app', // Production Vercel
  'https://t-link-l41i.vercel.app',   // Old Vercel project
  'https://t-link-vv3r.vercel.app',   // New Vercel project
  'http://localhost:3000',
  'http://10.0.0.41:3000',             // Network access
];
console.log('CORS origins:', corsOrigins);
console.log('Build version:', BUILD_VERSION);
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
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
app.use('/api/auth', authRoutes);
app.use('/api/test-methods', testMethodsRoutes);
app.use('/api/coa', coaRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sample-inventory', sampleInventoryRoutes);
app.use('/api/shipments', shipmentsRoutes);
app.use('/api/manufacturer', manufacturerRoutes);

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

