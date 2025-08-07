const bcrypt = require('bcryptjs');
const { query, transaction } = require('./connection');
const logger = require('../utils/logger');

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    await transaction(async (client) => {
      // Seed job categories
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
        await client.query(`
          INSERT INTO job_categories (title, description)
          VALUES ($1, $2)
          ON CONFLICT (title) DO NOTHING
        `, [category.title, category.description]);
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
        await client.query(`
          INSERT INTO countries (code, name, total_employers)
          VALUES ($1, $2, $3)
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            total_employers = EXCLUDED.total_employers
        `, [country.code, country.name, country.total_employers]);
      }

      // Seed sample employers
      const sampleEmployers = [
        // USA - Software Development
        { name: 'Google Inc.', country_code: 'USA', job_category_id: 1, industry: 'Technology', company_size: 'Enterprise' },
        { name: 'Microsoft Corporation', country_code: 'USA', job_category_id: 1, industry: 'Technology', company_size: 'Enterprise' },
        { name: 'Apple Inc.', country_code: 'USA', job_category_id: 1, industry: 'Technology', company_size: 'Enterprise' },
        { name: 'Amazon Web Services', country_code: 'USA', job_category_id: 1, industry: 'Technology', company_size: 'Enterprise' },
        { name: 'Meta Platforms', country_code: 'USA', job_category_id: 1, industry: 'Technology', company_size: 'Enterprise' },
        
        // USA - Marketing & Sales
        { name: 'Salesforce Inc.', country_code: 'USA', job_category_id: 2, industry: 'Technology', company_size: 'Large' },
        { name: 'HubSpot Inc.', country_code: 'USA', job_category_id: 2, industry: 'Technology', company_size: 'Large' },
        { name: 'Adobe Inc.', country_code: 'USA', job_category_id: 2, industry: 'Technology', company_size: 'Large' },
        
        // USA - Finance
        { name: 'JPMorgan Chase', country_code: 'USA', job_category_id: 3, industry: 'Finance', company_size: 'Enterprise' },
        { name: 'Goldman Sachs', country_code: 'USA', job_category_id: 3, industry: 'Finance', company_size: 'Large' },
        { name: 'Morgan Stanley', country_code: 'USA', job_category_id: 3, industry: 'Finance', company_size: 'Large' },
        
        // Canada - Software Development
        { name: 'Shopify Inc.', country_code: 'CAN', job_category_id: 1, industry: 'Technology', company_size: 'Large' },
        { name: 'BlackBerry Limited', country_code: 'CAN', job_category_id: 1, industry: 'Technology', company_size: 'Large' },
        { name: 'Corel Corporation', country_code: 'CAN', job_category_id: 1, industry: 'Technology', company_size: 'Medium' },
        
        // UK - Software Development
        { name: 'DeepMind Technologies', country_code: 'GBR', job_category_id: 1, industry: 'Technology', company_size: 'Large' },
        { name: 'Arm Holdings', country_code: 'GBR', job_category_id: 1, industry: 'Technology', company_size: 'Large' },
        { name: 'Sage Group', country_code: 'GBR', job_category_id: 1, industry: 'Technology', company_size: 'Large' },
        
        // UK - Finance
        { name: 'HSBC Holdings', country_code: 'GBR', job_category_id: 3, industry: 'Finance', company_size: 'Enterprise' },
        { name: 'Barclays PLC', country_code: 'GBR', job_category_id: 3, industry: 'Finance', company_size: 'Enterprise' },
        { name: 'Lloyds Banking Group', country_code: 'GBR', job_category_id: 3, industry: 'Finance', company_size: 'Enterprise' },
        
        // Germany - Engineering
        { name: 'Siemens AG', country_code: 'DEU', job_category_id: 6, industry: 'Engineering', company_size: 'Enterprise' },
        { name: 'Bosch Group', country_code: 'DEU', job_category_id: 6, industry: 'Engineering', company_size: 'Enterprise' },
        { name: 'BMW Group', country_code: 'DEU', job_category_id: 6, industry: 'Automotive', company_size: 'Enterprise' },
        
        // Australia - Software Development
        { name: 'Atlassian Corporation', country_code: 'AUS', job_category_id: 1, industry: 'Technology', company_size: 'Large' },
        { name: 'Canva Pty Ltd', country_code: 'AUS', job_category_id: 1, industry: 'Technology', company_size: 'Large' },
        { name: 'WiseTech Global', country_code: 'AUS', job_category_id: 1, industry: 'Technology', company_size: 'Medium' }
      ];

      for (const employer of sampleEmployers) {
        await client.query(`
          INSERT INTO employers (name, country_code, job_category_id, industry, company_size)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (name, country_code, job_category_id) DO NOTHING
        `, [employer.name, employer.country_code, employer.job_category_id, employer.industry, employer.company_size]);
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

      // Seed email templates
      const emailTemplates = [
        {
          key: 'welcome_email',
          subject: 'Welcome to NextMatch AI!',
          html_content: `
            <h1>Welcome to NextMatch AI, {{user_name}}!</h1>
            <p>Thank you for joining our AI-powered resume platform.</p>
            <p>You can now create professional resumes and connect with thousands of employers worldwide.</p>
            <p><a href="{{frontend_url}}/dashboard">Get Started</a></p>
            <p>Best regards,<br>The NextMatch Team</p>
          `,
          text_content: 'Welcome to NextMatch AI! Thank you for joining our platform.',
          variables: ['user_name', 'frontend_url']
        },
        {
          key: 'subscription_confirmation',
          subject: 'Subscription Confirmed - NextMatch AI',
          html_content: `
            <h1>Subscription Confirmed!</h1>
            <p>Hi {{user_name}},</p>
            <p>Your subscription has been confirmed. You now have access to {{countries_count}} countries for 6 months.</p>
            <p>Countries: {{country_list}}</p>
            <p>Amount: ${{total_amount}}</p>
            <p><a href="{{frontend_url}}/dashboard">View Dashboard</a></p>
          `,
          text_content: 'Your NextMatch AI subscription has been confirmed.',
          variables: ['user_name', 'countries_count', 'country_list', 'total_amount', 'frontend_url']
        },
        {
          key: 'simulation_started',
          subject: 'Resume Simulation Started - NextMatch AI',
          html_content: `
            <h1>Resume Simulation Started!</h1>
            <p>Hi {{user_name}},</p>
            <p>Your resume for "{{job_title}}" is now being sent to employers in {{country_name}}.</p>
            <p>We'll send you updates as employers open and shortlist your resume.</p>
            <p><a href="{{frontend_url}}/dashboard">Track Progress</a></p>
          `,
          text_content: 'Your resume simulation has started.',
          variables: ['user_name', 'job_title', 'country_name', 'frontend_url']
        }
      ];

      for (const template of emailTemplates) {
        await client.query(`
          INSERT INTO email_templates (template_key, subject, html_content, text_content, variables)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (template_key) DO UPDATE SET
            subject = EXCLUDED.subject,
            html_content = EXCLUDED.html_content,
            text_content = EXCLUDED.text_content,
            variables = EXCLUDED.variables,
            updated_at = CURRENT_TIMESTAMP
        `, [template.key, template.subject, template.html_content, template.text_content, template.variables]);
      }
    });

    logger.info('Database seeding completed successfully');
    logger.info(`Default admin credentials: ${process.env.ADMIN_EMAIL || 'admin@nextmatch.ai'} / ${process.env.ADMIN_PASSWORD || 'admin123456'}`);

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