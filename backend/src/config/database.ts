import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Auto-detect SSL: Enable for remote databases (not localhost)
const isProduction = process.env.NODE_ENV === 'production';
const isRemoteDb = process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') && !process.env.DB_HOST.includes('127.0.0.1');
const sslEnabled = process.env.DB_SSL === 'false' ? false : (isRemoteDb || isProduction || process.env.DB_SSL === 'true');

// Use simpler SSL configuration - just require SSL without certificate validation
const sslConfig = sslEnabled ? { rejectUnauthorized: false } : false;

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tlink_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased timeout
  ssl: sslConfig,
};

console.log(`Database SSL config:`, JSON.stringify({ ssl: sslConfig, enabled: sslEnabled }));

console.log(`Database SSL: ${sslEnabled ? 'enabled' : 'disabled'} (HOST: ${process.env.DB_HOST}, NODE_ENV: ${process.env.NODE_ENV})`);

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

export default pool;
