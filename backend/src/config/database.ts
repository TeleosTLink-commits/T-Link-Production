import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Auto-detect SSL: Enable for remote databases (not localhost)
const isProduction = process.env.NODE_ENV === 'production';
const isRemoteDb = process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') && !process.env.DB_HOST.includes('127.0.0.1');
const sslEnabled = process.env.DB_SSL === 'false' ? false : (isRemoteDb || isProduction || process.env.DB_SSL === 'true');

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tlink_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: sslEnabled ? {
    rejectUnauthorized: false, // Required for Render PostgreSQL
    // Allow custom CA certificate if provided
    ca: process.env.DB_SSL_CA ? process.env.DB_SSL_CA : undefined,
  } : false,
};

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
