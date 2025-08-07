require('dotenv').config();
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
    
    // Split by semicolon but handle PostgreSQL functions with $$ delimiters
    const statements = [];
    let currentStatement = '';
    let inFunction = false;
    
    const lines = schema.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip comments
      if (trimmedLine.startsWith('--') || trimmedLine === '') {
        continue;
      }
      
      currentStatement += line + '\n';
      
      // Check for function start/end
      if (trimmedLine.includes('$$')) {
        inFunction = !inFunction;
      }
      
      // If we hit a semicolon and we're not in a function, end the statement
      if (trimmedLine.endsWith(';') && !inFunction) {
        const stmt = currentStatement.trim();
        if (stmt.length > 0) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }
    
    for (const statement of statements) {
      try {
        await query(statement);
        logger.debug('Executed:', statement.substring(0, 50) + '...');
      } catch (error) {
        // Ignore "already exists" errors and some column/relation errors during development
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('relation') && error.message.includes('does not exist')) {
          logger.debug('Skipped (already exists or dependency issue):', statement.substring(0, 50) + '...');
        } else {
          logger.error('Failed to execute statement:', statement.substring(0, 100) + '...');
          throw error;
        }
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