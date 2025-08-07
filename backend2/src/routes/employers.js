const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { query, transaction } = require('../database/connection');
const { validate, schemas } = require('../utils/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticateAdmin, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for CSV file uploads
const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get all employers (admin only)
router.get('/',
  authenticateAdmin,
  validate(schemas.pagination, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, country_code, job_category_id, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE e.is_active = true';
    const params = [];
    let paramCount = 0;

    if (country_code) {
      paramCount++;
      whereClause += ` AND e.country_code = $${paramCount}`;
      params.push(country_code);
    }

    if (job_category_id) {
      paramCount++;
      whereClause += ` AND e.job_category_id = $${paramCount}`;
      params.push(job_category_id);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND e.name ILIKE $${paramCount}`;
      params.push(`%${search}%`);
    }

    const [employersResult, countResult] = await Promise.all([
      query(`
        SELECT e.*, c.name as country_name, jc.title as job_category_title
        FROM employers e
        LEFT JOIN countries c ON e.country_code = c.code
        LEFT JOIN job_categories jc ON e.job_category_id = jc.id
        ${whereClause}
        ORDER BY e.name
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]),
      
      query(`
        SELECT COUNT(*) as total
        FROM employers e
        ${whereClause}
      `, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        employers: employersResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  })
);

// Get employer statistics
router.get('/stats',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_employers,
        COUNT(DISTINCT country_code) as countries_count,
        COUNT(DISTINCT job_category_id) as job_categories_count,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_employers,
        COUNT(CASE WHEN company_size = 'Small' THEN 1 END) as small_companies,
        COUNT(CASE WHEN company_size = 'Medium' THEN 1 END) as medium_companies,
        COUNT(CASE WHEN company_size = 'Large' THEN 1 END) as large_companies,
        COUNT(CASE WHEN company_size = 'Enterprise' THEN 1 END) as enterprise_companies
      FROM employers
    `);

    // Get top countries by employer count
    const topCountries = await query(`
      SELECT e.country_code, c.name as country_name, COUNT(*) as employer_count
      FROM employers e
      LEFT JOIN countries c ON e.country_code = c.code
      WHERE e.is_active = true
      GROUP BY e.country_code, c.name
      ORDER BY employer_count DESC
      LIMIT 10
    `);

    // Get top job categories by employer count
    const topJobCategories = await query(`
      SELECT e.job_category_id, jc.title as job_category_title, COUNT(*) as employer_count
      FROM employers e
      LEFT JOIN job_categories jc ON e.job_category_id = jc.id
      WHERE e.is_active = true
      GROUP BY e.job_category_id, jc.title
      ORDER BY employer_count DESC
      LIMIT 10
    `);

    const employerStats = {
      overview: stats.rows[0],
      top_countries: topCountries.rows,
      top_job_categories: topJobCategories.rows
    };

    // Convert numeric strings to numbers
    Object.keys(employerStats.overview).forEach(key => {
      const value = employerStats.overview[key];
      if (value !== null && !isNaN(value)) {
        employerStats.overview[key] = parseInt(value);
      }
    });

    res.json({
      success: true,
      data: { stats: employerStats }
    });
  })
);

// Upload employers CSV (admin only)
router.post('/upload',
  authenticateAdmin,
  authorize('admin', 'super_admin'),
  upload.single('csv'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError('CSV file is required', 400);
    }

    const filePath = req.file.path;
    const results = [];
    const errors = [];
    let processedCount = 0;
    let successCount = 0;

    try {
      // Parse CSV file
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            results.push(data);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      logger.info(`Processing ${results.length} employers from CSV`);

      // Process each employer record
      for (const [index, row] of results.entries()) {
        processedCount++;
        
        try {
          // Validate required fields
          if (!row.name || !row.country_code || !row.job_category_id) {
            errors.push({
              row: index + 1,
              error: 'Missing required fields: name, country_code, job_category_id'
            });
            continue;
          }

          // Validate country exists
          const countryCheck = await query(
            'SELECT code FROM countries WHERE code = $1',
            [row.country_code.toUpperCase()]
          );

          if (countryCheck.rows.length === 0) {
            errors.push({
              row: index + 1,
              error: `Invalid country code: ${row.country_code}`
            });
            continue;
          }

          // Validate job category exists
          const jobCategoryCheck = await query(
            'SELECT id FROM job_categories WHERE id = $1',
            [parseInt(row.job_category_id)]
          );

          if (jobCategoryCheck.rows.length === 0) {
            errors.push({
              row: index + 1,
              error: `Invalid job category ID: ${row.job_category_id}`
            });
            continue;
          }

          // Insert or update employer
          await query(`
            INSERT INTO employers (name, country_code, job_category_id, industry, company_size)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (name, country_code, job_category_id) 
            DO UPDATE SET 
              industry = EXCLUDED.industry,
              company_size = EXCLUDED.company_size,
              updated_at = CURRENT_TIMESTAMP
          `, [
            row.name.trim(),
            row.country_code.toUpperCase(),
            parseInt(row.job_category_id),
            row.industry || null,
            row.company_size || null
          ]);

          successCount++;

        } catch (error) {
          errors.push({
            row: index + 1,
            error: error.message
          });
        }
      }

      // Update country employer counts
      await this.updateCountryEmployerCounts();

      logger.info(`CSV upload completed: ${successCount}/${processedCount} employers processed successfully`);

      res.json({
        success: true,
        message: 'CSV upload completed',
        data: {
          processed: processedCount,
          successful: successCount,
          errors: errors.length,
          error_details: errors.slice(0, 10) // Return first 10 errors
        }
      });

    } catch (error) {
      logger.error('Error processing CSV:', error);
      throw new AppError('Failed to process CSV file', 500);
    } finally {
      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) logger.error('Error deleting uploaded file:', err);
      });
    }
  })
);

// Add single employer (admin only)
router.post('/',
  authenticateAdmin,
  authorize('admin', 'super_admin'),
  validate(schemas.employerData),
  asyncHandler(async (req, res) => {
    const { name, country_code, job_category_id, industry, company_size } = req.body;

    // Validate country and job category exist
    const [countryCheck, jobCategoryCheck] = await Promise.all([
      query('SELECT code FROM countries WHERE code = $1', [country_code]),
      query('SELECT id FROM job_categories WHERE id = $1', [job_category_id])
    ]);

    if (countryCheck.rows.length === 0) {
      throw new AppError('Invalid country code', 400);
    }

    if (jobCategoryCheck.rows.length === 0) {
      throw new AppError('Invalid job category', 400);
    }

    const result = await query(`
      INSERT INTO employers (name, country_code, job_category_id, industry, company_size)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [name, country_code, job_category_id, industry, company_size]);

    const employer = result.rows[0];

    // Update country employer count
    await this.updateCountryEmployerCounts();

    logger.info(`Employer created: ${employer.id} (${name})`);

    res.status(201).json({
      success: true,
      message: 'Employer created successfully',
      data: { employer }
    });
  })
);

// Update employer (admin only)
router.put('/:employerId',
  authenticateAdmin,
  authorize('admin', 'super_admin'),
  validate(schemas.employerData),
  asyncHandler(async (req, res) => {
    const { employerId } = req.params;
    const { name, country_code, job_category_id, industry, company_size } = req.body;

    // Validate country and job category exist
    const [countryCheck, jobCategoryCheck] = await Promise.all([
      query('SELECT code FROM countries WHERE code = $1', [country_code]),
      query('SELECT id FROM job_categories WHERE id = $1', [job_category_id])
    ]);

    if (countryCheck.rows.length === 0) {
      throw new AppError('Invalid country code', 400);
    }

    if (jobCategoryCheck.rows.length === 0) {
      throw new AppError('Invalid job category', 400);
    }

    const result = await query(`
      UPDATE employers 
      SET name = $1, country_code = $2, job_category_id = $3, 
          industry = $4, company_size = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [name, country_code, job_category_id, industry, company_size, employerId]);

    if (result.rows.length === 0) {
      throw new AppError('Employer not found', 404);
    }

    const employer = result.rows[0];

    // Update country employer counts
    await this.updateCountryEmployerCounts();

    logger.info(`Employer updated: ${employerId}`);

    res.json({
      success: true,
      message: 'Employer updated successfully',
      data: { employer }
    });
  })
);

// Delete employer (admin only)
router.delete('/:employerId',
  authenticateAdmin,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { employerId } = req.params;

    const result = await query(
      'UPDATE employers SET is_active = false WHERE id = $1 RETURNING id',
      [employerId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Employer not found', 404);
    }

    // Update country employer counts
    await this.updateCountryEmployerCounts();

    logger.info(`Employer deactivated: ${employerId}`);

    res.json({
      success: true,
      message: 'Employer deactivated successfully'
    });
  })
);

// Get employers by country and job category (public endpoint for frontend)
router.get('/by-country/:countryCode',
  validate(schemas.countryCode, 'params'),
  asyncHandler(async (req, res) => {
    const { countryCode } = req.params;
    const { job_category_id } = req.query;

    let whereClause = 'WHERE e.country_code = $1 AND e.is_active = true';
    const params = [countryCode];

    if (job_category_id) {
      params.push(job_category_id);
      whereClause += ` AND e.job_category_id = $${params.length}`;
    }

    const result = await query(`
      SELECT COUNT(*) as employer_count,
             COUNT(CASE WHEN company_size = 'Small' THEN 1 END) as small_companies,
             COUNT(CASE WHEN company_size = 'Medium' THEN 1 END) as medium_companies,
             COUNT(CASE WHEN company_size = 'Large' THEN 1 END) as large_companies,
             COUNT(CASE WHEN company_size = 'Enterprise' THEN 1 END) as enterprise_companies
      FROM employers e
      ${whereClause}
    `, params);

    const stats = result.rows[0];

    // Convert to numbers
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(stats[key]);
    });

    res.json({
      success: true,
      data: { stats }
    });
  })
);

// Bulk update employer statuses (admin only)
router.patch('/bulk-update',
  authenticateAdmin,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { employer_ids, action } = req.body;

    if (!employer_ids || !Array.isArray(employer_ids) || employer_ids.length === 0) {
      throw new AppError('Employer IDs array is required', 400);
    }

    if (!['activate', 'deactivate'].includes(action)) {
      throw new AppError('Action must be either "activate" or "deactivate"', 400);
    }

    const isActive = action === 'activate';

    const result = await query(`
      UPDATE employers 
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2)
      RETURNING id
    `, [isActive, employer_ids]);

    // Update country employer counts
    await this.updateCountryEmployerCounts();

    logger.info(`Bulk ${action} completed for ${result.rows.length} employers`);

    res.json({
      success: true,
      message: `${result.rows.length} employers ${action}d successfully`
    });
  })
);

// Helper function to update country employer counts
async function updateCountryEmployerCounts() {
  await query(`
    UPDATE countries 
    SET total_employers = (
      SELECT COUNT(*) 
      FROM employers 
      WHERE country_code = countries.code 
      AND is_active = true
    )
  `);
}

// Export CSV template (admin only)
router.get('/csv-template',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const csvTemplate = `name,country_code,job_category_id,industry,company_size
"Example Company Inc","USA",1,"Technology","Large"
"Sample Corp","CAN",2,"Finance","Medium"
"Test Ltd","GBR",3,"Healthcare","Small"`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="employers_template.csv"');
    res.send(csvTemplate);
  })
);

// Attach the helper function to the router for access in route handlers
router.updateCountryEmployerCounts = updateCountryEmployerCounts;

module.exports = router;