require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query, transaction } = require('./connection');
const logger = require('../utils/logger');

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // Seed job categories first
    const jobCategories = [
      { title: 'Software Development', description: 'Programming, web development, mobile apps' },
      { title: 'Marketing & Sales', description: 'Digital marketing, sales, business development' },
      { title: 'Finance & Accounting', description: 'Financial analysis, accounting, banking' },
      { title: 'Healthcare', description: 'Medical, nursing, healthcare administration' },
      { title: 'Education', description: 'Teaching, training, educational administration' },
      { title: 'Engineering', description: 'Mechanical, electrical, civil engineering' },
      { title: 'Design & Creative', description: 'Graphic design, UX/UI, creative arts' },
      { title: 'Human Resources', description: 'HR management, recruitment, employee relations' },
      { title: 'Operations & Management', description: 'Operations, project management, consulting' },
      { title: 'Customer Service', description: 'Customer support, client relations' }
    ];

    for (const category of jobCategories) {
      try {
        await query(`
          INSERT INTO job_categories (title, description)
          VALUES ($1, $2)
          ON CONFLICT (title) DO NOTHING
        `, [category.title, category.description]);
        logger.debug('Inserted job category:', category.title);
      } catch (error) {
        logger.error('Failed to insert job category:', category.title, error.message);
      }
    }

    // Seed countries
    const countries = [
      { code: 'USA', name: 'United States', total_employers: 15000 },
      { code: 'CAN', name: 'Canada', total_employers: 8000 },
      { code: 'GBR', name: 'United Kingdom', total_employers: 12000 },
      { code: 'AUS', name: 'Australia', total_employers: 6000 },
      { code: 'DEU', name: 'Germany', total_employers: 10000 },
      { code: 'FRA', name: 'France', total_employers: 9000 },
      { code: 'NLD', name: 'Netherlands', total_employers: 4000 },
      { code: 'SWE', name: 'Sweden', total_employers: 3000 },
      { code: 'CHE', name: 'Switzerland', total_employers: 3500 },
      { code: 'SGP', name: 'Singapore', total_employers: 2500 }
    ];

    for (const country of countries) {
      try {
        await query(`
          INSERT INTO countries (code, name, total_employers)
          VALUES ($1, $2, $3)
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            total_employers = EXCLUDED.total_employers
        `, [country.code, country.name, country.total_employers]);
        logger.debug('Inserted country:', country.name);
      } catch (error) {
        logger.error('Failed to insert country:', country.name, error.message);
      }
    }

    // Get job category IDs
    const jobCategoryMap = {};
    const categoryResult = await query('SELECT id, title FROM job_categories');
    categoryResult.rows.forEach(row => {
      jobCategoryMap[row.title] = row.id;
    });

    // Seed sample employers (using transaction for employers only)
    await transaction(async (client) => {
      const sampleEmployers = [
        // USA - Software Development
        { name: 'Google Inc.', country_code: 'USA', job_category_id: jobCategoryMap['Software Development'], industry: 'Technology', company_size: 'Enterprise' },
        { name: 'Microsoft Corporation', country_code: 'USA', job_category_id: jobCategoryMap['Software Development'], industry: 'Technology', company_size: 'Enterprise' },
        { name: 'Apple Inc.', country_code: 'USA', job_category_id: jobCategoryMap['Software Development'], industry: 'Technology', company_size: 'Enterprise' },
        { name: 'Amazon Web Services', country_code: 'USA', job_category_id: jobCategoryMap['Software Development'], industry: 'Technology', company_size: 'Enterprise' },
        { name: 'Meta Platforms', country_code: 'USA', job_category_id: jobCategoryMap['Software Development'], industry: 'Technology', company_size: 'Enterprise' },
        
        // USA - Marketing & Sales
        { name: 'Salesforce Inc.', country_code: 'USA', job_category_id: jobCategoryMap['Marketing & Sales'], industry: 'Technology', company_size: 'Large' },
        { name: 'HubSpot Inc.', country_code: 'USA', job_category_id: jobCategoryMap['Marketing & Sales'], industry: 'Technology', company_size: 'Large' },
        { name: 'Adobe Inc.', country_code: 'USA', job_category_id: jobCategoryMap['Marketing & Sales'], industry: 'Technology', company_size: 'Large' },
        
        // USA - Finance
        { name: 'JPMorgan Chase', country_code: 'USA', job_category_id: jobCategoryMap['Finance & Accounting'], industry: 'Finance', company_size: 'Enterprise' },
        { name: 'Goldman Sachs', country_code: 'USA', job_category_id: jobCategoryMap['Finance & Accounting'], industry: 'Finance', company_size: 'Large' },
        { name: 'Morgan Stanley', country_code: 'USA', job_category_id: jobCategoryMap['Finance & Accounting'], industry: 'Finance', company_size: 'Large' },
        
        // Canada - Software Development
        { name: 'Shopify Inc.', country_code: 'CAN', job_category_id: jobCategoryMap['Software Development'], industry: 'Technology', company_size: 'Large' },
        
        // UK - Finance
        { name: 'HSBC Holdings', country_code: 'GBR', job_category_id: jobCategoryMap['Finance & Accounting'], industry: 'Finance', company_size: 'Enterprise' },
        
        // Germany - Engineering
        { name: 'Siemens AG', country_code: 'DEU', job_category_id: jobCategoryMap['Engineering'], industry: 'Engineering', company_size: 'Enterprise' }
      ];

      for (const employer of sampleEmployers) {
        try {
          await client.query(`
            INSERT INTO employers (name, country_code, job_category_id, industry, company_size)
            VALUES ($1, $2, $3, $4, $5)
          `, [employer.name, employer.country_code, employer.job_category_id, employer.industry, employer.company_size]);
        } catch (error) {
          // Skip if employer already exists
          if (!error.message.includes('duplicate key')) {
            throw error;
          }
        }
      }

      // Create default admin user
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@nextmatch.ai';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';
      const passwordHash = await bcrypt.hash(adminPassword, 12);

      await client.query(`
        INSERT INTO admin_users (email, password_hash, name, role)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          updated_at = CURRENT_TIMESTAMP
      `, [adminEmail, passwordHash, 'System Administrator', 'super_admin']);

      // Seed system settings
      const systemSettings = [
        { key: 'simulation_min_hours', value: '1', description: 'Minimum simulation duration in hours', data_type: 'number' },
        { key: 'simulation_max_hours', value: '96', description: 'Maximum simulation duration in hours', data_type: 'number' },
        { key: 'update_interval_hours', value: '2', description: 'Simulation update interval in hours', data_type: 'number' },
        { key: 'price_per_country', value: '1.99', description: 'Price per country in USD', data_type: 'number', is_public: true },
        { key: 'billing_cycle_months', value: '6', description: 'Billing cycle in months', data_type: 'number', is_public: true },
        { key: 'max_countries_per_subscription', value: '10', description: 'Maximum countries per subscription', data_type: 'number' },
        { key: 'resume_quality_weight', value: '0.4', description: 'Weight for resume quality score', data_type: 'number' },
        { key: 'skill_match_weight', value: '0.35', description: 'Weight for skill match score', data_type: 'number' },
        { key: 'completeness_weight', value: '0.25', description: 'Weight for completeness score', data_type: 'number' },
        { key: 'maintenance_mode', value: 'false', description: 'Enable maintenance mode', data_type: 'boolean', is_public: true },
        { key: 'support_email', value: 'support@nextmatch.ai', description: 'Support email address', data_type: 'string', is_public: true },
        { key: 'company_name', value: 'NextMatch AI', description: 'Company name', data_type: 'string', is_public: true }
      ];

      for (const setting of systemSettings) {
        await client.query(`
          INSERT INTO system_settings (setting_key, setting_value, description, data_type, is_public)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (setting_key) DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            description = EXCLUDED.description,
            updated_at = CURRENT_TIMESTAMP
        `, [setting.key, setting.value, setting.description, setting.data_type, setting.is_public || false]);
      }

      logger.info('Database seeding completed successfully');
    });

    logger.info('All seeding operations completed');
  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      logger.info('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };