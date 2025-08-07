const express = require('express');
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../database/connection');
const { validate, schemas } = require('../utils/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticateAdmin, authorize } = require('../middleware/auth');
const SimulationService = require('../services/simulationService');
const AWSService = require('../services/awsService');
const logger = require('../utils/logger');

const router = express.Router();

// Get admin dashboard overview
router.get('/dashboard',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    // Get system statistics
    const [userStats, resumeStats, subscriptionStats, simulationStats] = await Promise.all([
      // User statistics
      query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_30d,
          COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as active_users_7d
        FROM users
      `),

      // Resume statistics
      query(`
        SELECT 
          COUNT(*) as total_resumes,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_resumes,
          AVG(overall_score) as avg_score,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_resumes_30d
        FROM resumes
      `),

      // Subscription statistics
      query(`
        SELECT 
          COUNT(*) as total_subscriptions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions,
          SUM(CASE WHEN status = 'active' THEN total_amount ELSE 0 END) as active_revenue,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_subscriptions_30d
        FROM subscriptions
      `),

      // Simulation statistics
      query(`
        SELECT 
          COUNT(*) as total_simulations,
          COUNT(CASE WHEN status = 'running' THEN 1 END) as running_simulations,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_simulations,
          SUM(current_opens) as total_opens,
          SUM(current_shortlists) as total_shortlists
        FROM resume_simulations
      `)
    ]);

    // Get recent activity
    const recentActivity = await query(`
      SELECT 'user_registered' as activity_type, created_at as timestamp,
             json_build_object('user_id', id, 'email', email, 'name', name) as data
      FROM users 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 'subscription_created' as activity_type, created_at as timestamp,
             json_build_object('subscription_id', id, 'user_id', user_id, 'amount', total_amount) as data
      FROM subscriptions 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 'simulation_started' as activity_type, created_at as timestamp,
             json_build_object('simulation_id', id, 'resume_id', resume_id, 'country_code', country_code) as data
      FROM resume_simulations 
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      
      ORDER BY timestamp DESC
      LIMIT 20
    `);

    const dashboard = {
      user_stats: userStats.rows[0],
      resume_stats: resumeStats.rows[0],
      subscription_stats: subscriptionStats.rows[0],
      simulation_stats: simulationStats.rows[0],
      recent_activity: recentActivity.rows
    };

    // Convert numeric strings to numbers
    ['user_stats', 'resume_stats', 'subscription_stats', 'simulation_stats'].forEach(category => {
      Object.keys(dashboard[category]).forEach(key => {
        const value = dashboard[category][key];
        if (value !== null && !isNaN(value)) {
          dashboard[category][key] = parseFloat(value);
        }
      });
    });

    res.json({
      success: true,
      data: { dashboard }
    });
  })
);

// Get system health status
router.get('/health',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const health = {
      database: false,
      aws_services: {},
      simulation_service: false,
      timestamp: new Date().toISOString()
    };

    try {
      // Check database
      await query('SELECT 1');
      health.database = true;
    } catch (error) {
      logger.error('Database health check failed:', error);
    }

    try {
      // Check AWS services
      health.aws_services = await AWSService.checkAWSHealth();
    } catch (error) {
      logger.error('AWS health check failed:', error);
    }

    try {
      // Check simulation service
      const stats = await SimulationService.getSimulationStats();
      health.simulation_service = true;
      health.simulation_stats = stats;
    } catch (error) {
      logger.error('Simulation service health check failed:', error);
    }

    const overallHealth = health.database && 
                         health.aws_services.s3 && 
                         health.aws_services.ses && 
                         health.simulation_service;

    res.json({
      success: true,
      data: { 
        health,
        overall_status: overallHealth ? 'healthy' : 'degraded'
      }
    });
  })
);

// Get all users (admin only)
router.get('/users',
  authenticateAdmin,
  validate(schemas.pagination, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, search, country_code, is_active } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClause += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (country_code) {
      paramCount++;
      whereClause += ` AND u.country_code = $${paramCount}`;
      params.push(country_code);
    }

    if (is_active !== undefined) {
      paramCount++;
      whereClause += ` AND u.is_active = $${paramCount}`;
      params.push(is_active === 'true');
    }

    const [usersResult, countResult] = await Promise.all([
      query(`
        SELECT u.*, c.name as country_name, jc.title as job_category_title,
               COUNT(r.id) as resume_count,
               COUNT(s.id) as subscription_count
        FROM users u
        LEFT JOIN countries c ON u.country_code = c.code
        LEFT JOIN job_categories jc ON u.job_category_id = jc.id
        LEFT JOIN resumes r ON u.id = r.user_id
        LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
        ${whereClause}
        GROUP BY u.id, c.name, jc.title
        ORDER BY u.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]),
      
      query(`
        SELECT COUNT(*) as total
        FROM users u
        ${whereClause}
      `, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users: usersResult.rows,
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

// Get user details (admin only)
router.get('/users/:userId',
  authenticateAdmin,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const [userResult, resumesResult, subscriptionsResult, simulationsResult] = await Promise.all([
      // User details
      query(`
        SELECT u.*, c.name as country_name, jc.title as job_category_title
        FROM users u
        LEFT JOIN countries c ON u.country_code = c.code
        LEFT JOIN job_categories jc ON u.job_category_id = jc.id
        WHERE u.id = $1
      `, [userId]),

      // User's resumes
      query(`
        SELECT id, job_title, status, overall_score, created_at
        FROM resumes 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `, [userId]),

      // User's subscriptions
      query(`
        SELECT s.*, array_agg(sc.country_code) as countries
        FROM subscriptions s
        LEFT JOIN subscription_countries sc ON s.id = sc.subscription_id
        WHERE s.user_id = $1
        GROUP BY s.id
        ORDER BY s.created_at DESC
      `, [userId]),

      // User's simulations
      query(`
        SELECT rs.*, r.job_title, c.name as country_name
        FROM resume_simulations rs
        JOIN resumes r ON rs.resume_id = r.id
        LEFT JOIN countries c ON rs.country_code = c.code
        WHERE r.user_id = $1
        ORDER BY rs.created_at DESC
        LIMIT 10
      `, [userId])
    ]);

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const userDetails = {
      user: userResult.rows[0],
      resumes: resumesResult.rows,
      subscriptions: subscriptionsResult.rows,
      recent_simulations: simulationsResult.rows
    };

    res.json({
      success: true,
      data: userDetails
    });
  })
);

// Update user status (admin only)
router.patch('/users/:userId/status',
  authenticateAdmin,
  authorize('admin', 'super_admin'),
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      throw new AppError('is_active must be a boolean', 400);
    }

    const result = await query(`
      UPDATE users 
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, is_active
    `, [is_active, userId]);

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    logger.info(`User ${is_active ? 'activated' : 'deactivated'}: ${userId} by admin ${req.admin.id}`);

    res.json({
      success: true,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
      data: { user }
    });
  })
);

// Get system settings
router.get('/settings',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT setting_key, setting_value, description, data_type, is_public
      FROM system_settings
      ORDER BY setting_key
    `);

    const settings = {};
    result.rows.forEach(row => {
      let value = row.setting_value;
      
      // Parse value based on data type
      switch (row.data_type) {
        case 'number':
          value = parseFloat(value);
          break;
        case 'boolean':
          value = value === 'true';
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if JSON parsing fails
          }
          break;
      }

      settings[row.setting_key] = {
        value,
        description: row.description,
        data_type: row.data_type,
        is_public: row.is_public
      };
    });

    res.json({
      success: true,
      data: { settings }
    });
  })
);

// Update system setting
router.put('/settings/:settingKey',
  authenticateAdmin,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    const { settingKey } = req.params;
    const { value, description } = req.body;

    if (value === undefined) {
      throw new AppError('Setting value is required', 400);
    }

    const result = await query(`
      UPDATE system_settings 
      SET setting_value = $1, description = COALESCE($2, description), 
          updated_by = $3, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = $4
      RETURNING *
    `, [String(value), description, req.admin.id, settingKey]);

    if (result.rows.length === 0) {
      // Create new setting if it doesn't exist
      const insertResult = await query(`
        INSERT INTO system_settings (setting_key, setting_value, description, updated_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [settingKey, String(value), description, req.admin.id]);

      logger.info(`System setting created: ${settingKey} by admin ${req.admin.id}`);

      return res.json({
        success: true,
        message: 'Setting created successfully',
        data: { setting: insertResult.rows[0] }
      });
    }

    logger.info(`System setting updated: ${settingKey} by admin ${req.admin.id}`);

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: { setting: result.rows[0] }
    });
  })
);

// Get simulation management
router.get('/simulations',
  authenticateAdmin,
  validate(schemas.pagination, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, status, country_code } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      whereClause += ` AND rs.status = $${paramCount}`;
      params.push(status);
    }

    if (country_code) {
      paramCount++;
      whereClause += ` AND rs.country_code = $${paramCount}`;
      params.push(country_code);
    }

    const [simulationsResult, countResult] = await Promise.all([
      query(`
        SELECT rs.*, r.job_title, r.overall_score, u.name as user_name, u.email as user_email,
               c.name as country_name, dm.opens_count, dm.shortlists_count, dm.progress_percentage
        FROM resume_simulations rs
        JOIN resumes r ON rs.resume_id = r.id
        JOIN users u ON r.user_id = u.id
        LEFT JOIN countries c ON rs.country_code = c.code
        LEFT JOIN LATERAL (
          SELECT * FROM dashboard_metrics 
          WHERE simulation_id = rs.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) dm ON true
        ${whereClause}
        ORDER BY rs.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]),
      
      query(`
        SELECT COUNT(*) as total
        FROM resume_simulations rs
        JOIN resumes r ON rs.resume_id = r.id
        ${whereClause}
      `, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        simulations: simulationsResult.rows,
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

// Manually trigger simulation update
router.post('/simulations/update',
  authenticateAdmin,
  authorize('admin', 'super_admin'),
  asyncHandler(async (req, res) => {
    await SimulationService.updateAllActiveSimulations();

    logger.info(`Manual simulation update triggered by admin ${req.admin.id}`);

    res.json({
      success: true,
      message: 'Simulation update triggered successfully'
    });
  })
);

// Create admin user (super admin only)
router.post('/admins',
  authenticateAdmin,
  authorize('super_admin'),
  asyncHandler(async (req, res) => {
    const { email, password, name, role = 'admin' } = req.body;

    if (!email || !password || !name) {
      throw new AppError('Email, password, and name are required', 400);
    }

    if (!['admin', 'super_admin'].includes(role)) {
      throw new AppError('Invalid role', 400);
    }

    // Check if admin already exists
    const existingAdmin = await query(
      'SELECT id FROM admin_users WHERE email = $1',
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      throw new AppError('Admin with this email already exists', 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query(`
      INSERT INTO admin_users (email, password_hash, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, name, role, created_at
    `, [email, passwordHash, name, role]);

    const admin = result.rows[0];

    logger.info(`Admin user created: ${admin.id} (${email}) by super admin ${req.admin.id}`);

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: { admin }
    });
  })
);

// Get revenue analytics
router.get('/analytics/revenue',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    let interval;
    switch (period) {
      case '7d':
        interval = '7 days';
        break;
      case '30d':
        interval = '30 days';
        break;
      case '90d':
        interval = '90 days';
        break;
      case '1y':
        interval = '1 year';
        break;
      default:
        interval = '30 days';
    }

    const [revenueOverTime, revenueByCountry, subscriptionStats] = await Promise.all([
      // Revenue over time
      query(`
        SELECT DATE(created_at) as date, SUM(total_amount) as daily_revenue, COUNT(*) as daily_subscriptions
        FROM subscriptions
        WHERE created_at >= CURRENT_DATE - INTERVAL '${interval}'
        AND status = 'active'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `),

      // Revenue by country
      query(`
        SELECT sc.country_code, c.name as country_name, 
               COUNT(DISTINCT s.id) as subscription_count,
               SUM(s.total_amount) as total_revenue
        FROM subscriptions s
        JOIN subscription_countries sc ON s.id = sc.subscription_id
        LEFT JOIN countries c ON sc.country_code = c.code
        WHERE s.created_at >= CURRENT_DATE - INTERVAL '${interval}'
        AND s.status = 'active'
        GROUP BY sc.country_code, c.name
        ORDER BY total_revenue DESC
        LIMIT 10
      `),

      // Subscription statistics
      query(`
        SELECT 
          AVG(countries_count) as avg_countries_per_subscription,
          AVG(total_amount) as avg_subscription_value,
          COUNT(CASE WHEN countries_count = 1 THEN 1 END) as single_country_subs,
          COUNT(CASE WHEN countries_count > 1 THEN 1 END) as multi_country_subs
        FROM subscriptions
        WHERE created_at >= CURRENT_DATE - INTERVAL '${interval}'
        AND status = 'active'
      `)
    ]);

    const analytics = {
      revenue_over_time: revenueOverTime.rows,
      revenue_by_country: revenueByCountry.rows,
      subscription_stats: subscriptionStats.rows[0]
    };

    res.json({
      success: true,
      data: { analytics }
    });
  })
);

module.exports = router;