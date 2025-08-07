require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
  acquireTimeoutMillis: 10000, // Return an error after 10 seconds if acquiring a connection times out
});

// Test database connection
async function connectDB() {
  try {
    logger.info('Attempting to connect to database...', {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      ssl: process.env.DB_SSL === 'true'
    });
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection established:', result.rows[0]);
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// Query helper function
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query error:', { text, error: error.message });
    throw error;
  }
}

// Transaction helper
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Graceful shutdown
async function closeDB() {
  try {
    await pool.end();
    logger.info('Database connection pool closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
  }
}

module.exports = {
  pool,
  query,
  transaction,
  connectDB,
  closeDB
};