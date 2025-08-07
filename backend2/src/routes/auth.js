const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, transaction } = require('../database/connection');
const { validate, schemas } = require('../utils/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, optionalAuth } = require('../middleware/auth');
const AWSService = require('../services/awsService');
const logger = require('../utils/logger');

const router = express.Router();

// Register user after Cognito signup
router.post('/register', 
  validate(schemas.userProfile),
  asyncHandler(async (req, res) => {
    const { name, email, country_code, job_category_id, phone, cognito_sub } = req.body;

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR cognito_sub = $2',
      [email, cognito_sub]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Verify country and job category exist
    const countryCheck = await query('SELECT code FROM countries WHERE code = $1', [country_code]);
    const jobCategoryCheck = await query('SELECT id FROM job_categories WHERE id = $1', [job_category_id]);

    if (countryCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid country code'
      });
    }

    if (jobCategoryCheck.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job category'
      });
    }

    // Create user
    const result = await query(`
      INSERT INTO users (cognito_sub, email, name, country_code, job_category_id, phone, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, cognito_sub, email, name, country_code, job_category_id, phone, created_at
    `, [cognito_sub, email, name, country_code, job_category_id, phone]);

    const user = result.rows[0];

    logger.info(`User registered: ${user.id} (${email})`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: { user }
    });
  })
);

// Get current user profile
router.get('/profile', 
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const result = await query(`
      SELECT u.*, jc.title as job_category_title, c.name as country_name
      FROM users u
      LEFT JOIN job_categories jc ON u.job_category_id = jc.id
      LEFT JOIN countries c ON u.country_code = c.code
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];
    delete user.cognito_sub; // Don't expose Cognito sub

    res.json({
      success: true,
      data: { user }
    });
  })
);

// Update user profile
router.put('/profile',
  authenticate,
  validate(schemas.userProfile),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { name, country_code, job_category_id, phone } = req.body;

    // Verify country and job category exist
    const countryCheck = await query('SELECT code FROM countries WHERE code = $1', [country_code]);
    const jobCategoryCheck = await query('SELECT id FROM job_categories WHERE id = $1', [job_category_id]);

    if (countryCheck.rows.length === 0) {
      throw new AppError('Invalid country code', 400);
    }

    if (jobCategoryCheck.rows.length === 0) {
      throw new AppError('Invalid job category', 400);
    }

    const result = await query(`
      UPDATE users 
      SET name = $1, country_code = $2, job_category_id = $3, phone = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING id, email, name, country_code, job_category_id, phone, updated_at
    `, [name, country_code, job_category_id, phone, userId]);

    const user = result.rows[0];

    logger.info(`User profile updated: ${userId}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  })
);

// Get user dashboard summary
router.get('/dashboard',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get user's resumes count
    const resumesResult = await query(
      'SELECT COUNT(*) as total_resumes FROM resumes WHERE user_id = $1',
      [userId]
    );

    // Get active subscription
    const subscriptionResult = await query(`
      SELECT s.*, COUNT(sc.country_code) as countries_count
      FROM subscriptions s
      LEFT JOIN subscription_countries sc ON s.id = sc.subscription_id AND sc.is_active = true
      WHERE s.user_id = $1 
      AND s.status = 'active'
      AND s.current_period_end > CURRENT_TIMESTAMP
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [userId]);

    // Get recent simulations
    const simulationsResult = await query(`
      SELECT rs.*, dm.opens_count, dm.shortlists_count, dm.progress_percentage, c.name as country_name
      FROM resume_simulations rs
      LEFT JOIN LATERAL (
        SELECT * FROM dashboard_metrics 
        WHERE simulation_id = rs.id 
        ORDER BY timestamp DESC 
        LIMIT 1
      ) dm ON true
      LEFT JOIN countries c ON rs.country_code = c.code
      WHERE rs.resume_id IN (SELECT id FROM resumes WHERE user_id = $1)
      ORDER BY rs.created_at DESC
      LIMIT 5
    `, [userId]);

    const dashboard = {
      total_resumes: parseInt(resumesResult.rows[0].total_resumes),
      active_subscription: subscriptionResult.rows[0] || null,
      recent_simulations: simulationsResult.rows
    };

    res.json({
      success: true,
      data: { dashboard }
    });
  })
);

// Refresh user session (validate token and return user data)
router.post('/refresh',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = req.user;
    delete user.cognito_sub;

    res.json({
      success: true,
      message: 'Session refreshed',
      data: { user }
    });
  })
);

// Get available countries and job categories for registration
router.get('/options',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const [countriesResult, jobCategoriesResult] = await Promise.all([
      query('SELECT code, name, total_employers FROM countries WHERE is_active = true ORDER BY name'),
      query('SELECT id, title, description FROM job_categories WHERE is_active = true ORDER BY title')
    ]);

    res.json({
      success: true,
      data: {
        countries: countriesResult.rows,
        job_categories: jobCategoriesResult.rows
      }
    });
  })
);

// Deactivate user account
router.delete('/account',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const cognitoSub = req.user.cognito_sub;

    await transaction(async (client) => {
      // Deactivate user in database
      await client.query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );

      // Cancel active subscriptions
      await client.query(`
        UPDATE subscriptions 
        SET status = 'canceled', cancel_at_period_end = true, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND status = 'active'
      `, [userId]);

      // Pause active simulations
      await client.query(`
        UPDATE resume_simulations 
        SET status = 'paused', last_updated = CURRENT_TIMESTAMP
        WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = $1) 
        AND status = 'running'
      `, [userId]);
    });

    // Disable user in Cognito
    try {
      await AWSService.adminDisableUser(cognitoSub);
    } catch (error) {
      logger.error('Error disabling user in Cognito:', error);
      // Continue with the process even if Cognito fails
    }

    logger.info(`User account deactivated: ${userId}`);

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  })
);

// Admin login (separate from Cognito)
router.post('/admin/login',
  validate({
    email: schemas.email,
    password: require('joi').string().min(6).required()
  }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Get admin user
    const result = await query(
      'SELECT * FROM admin_users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401);
    }

    const admin = result.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Update last login
    await query(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [admin.id]
    );

    delete admin.password_hash;

    logger.info(`Admin login: ${admin.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        admin,
        token
      }
    });
  })
);

module.exports = router;