const fs = require('fs');
const path = require('path');
const { query } = require('./connection');
const logger = require('../utils/logger');

async function runMigrations() {
  try {
    logger.info('Starting database migrations...');
    
    // Read and execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      try {
        await query(statement);
        logger.debug('Executed:', statement.substring(0, 50) + '...');
      } catch (error) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          throw error;
        }
        logger.debug('Skipped existing:', statement.substring(0, 50) + '...');
      }
    }
    
    logger.info('Database migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run migrations if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migrations completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigrations };