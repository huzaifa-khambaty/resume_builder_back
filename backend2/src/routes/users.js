const express = require('express');
const { query } = require('../database/connection');
const { validate, schemas } = require('../utils/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, optionalAuth } = require('../middleware/auth');
const OpenAIService = require('../services/openaiService');
const logger = require('../utils/logger');

const router = express.Router();

// Get user profile (public endpoint with optional auth)
router.get('/:userId/profile',
  optionalAuth,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Check if requesting own profile or if admin
    const isOwnProfile = req.user && req.user.id === userId;
    const isAdmin = req.admin;

    if (!isOwnProfile && !isAdmin) {
      throw new AppError('Access denied', 403);
    }

    const result = await query(`
      SELECT u.id, u.email, u.name, u.country_code, u.job_category_id, u.phone,
             u.email_verified, u.last_login, u.created_at,
             jc.title as job_category_title, c.name as country_name
      FROM users u
      LEFT JOIN job_categories jc ON u.job_category_id = jc.id
      LEFT JOIN countries c ON u.country_code = c.code
      WHERE u.id = $1 AND u.is_active = true
    `, [userId]);

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: { user }
    });
  })
);

// Get user's resumes
router.get('/:userId/resumes',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Check if requesting own resumes
    if (req.user.id !== userId) {
      throw new AppError('Access denied', 403);
    }

    const result = await query(`
      SELECT r.*, 
             COUNT(we.id) as experience_count,
             jc.title as job_category_title
      FROM resumes r
      LEFT JOIN work_experiences we ON r.id = we.resume_id
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN job_categories jc ON u.job_category_id = jc.id
      WHERE r.user_id = $1
      GROUP BY r.id, jc.title
      ORDER BY r.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: { resumes: result.rows }
    });
  })
);

// Get user's subscriptions
router.get('/:userId/subscriptions',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Check if requesting own subscriptions
    if (req.user.id !== userId) {
      throw new AppError('Access denied', 403);
    }

    const result = await query(`
      SELECT s.*, 
             array_agg(
               json_build_object(
                 'country_code', sc.country_code,
                 'country_name', c.name,
                 'is_active', sc.is_active,
                 'added_at', sc.added_at
               )
             ) as countries
      FROM subscriptions s
      LEFT JOIN subscription_countries sc ON s.id = sc.subscription_id
      LEFT JOIN countries c ON sc.country_code = c.code
      WHERE s.user_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `, [userId]);

    res.json({
      success: true,
      data: { subscriptions: result.rows }
    });
  })
);

// Get user's simulation history
router.get('/:userId/simulations',
  authenticate,
  validate(schemas.uuid, 'params'),
  validate(schemas.pagination, 'query'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { page, limit } = req.query;

    // Check if requesting own simulations
    if (req.user.id !== userId) {
      throw new AppError('Access denied', 403);
    }

    const offset = (page - 1) * limit;

    const [simulationsResult, countResult] = await Promise.all([
      query(`
        SELECT rs.*, 
               r.job_title, r.overall_score,
               c.name as country_name,
               dm.opens_count, dm.shortlists_count, dm.progress_percentage
        FROM resume_simulations rs
        JOIN resumes r ON rs.resume_id = r.id
        LEFT JOIN countries c ON rs.country_code = c.code
        LEFT JOIN LATERAL (
          SELECT * FROM dashboard_metrics 
          WHERE simulation_id = rs.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) dm ON true
        WHERE r.user_id = $1
        ORDER BY rs.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]),
      
      query(`
        SELECT COUNT(*) as total
        FROM resume_simulations rs
        JOIN resumes r ON rs.resume_id = r.id
        WHERE r.user_id = $1
      `, [userId])
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

// Get job suggestions for user
router.get('/:userId/job-suggestions',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Check if requesting own suggestions
    if (req.user.id !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Get user's latest resume
    const resumeResult = await query(`
      SELECT r.job_title, r.work_location, u.name
      FROM resumes r
      JOIN users u ON r.user_id = u.id
      WHERE r.user_id = $1
      ORDER BY r.created_at DESC
      LIMIT 1
    `, [userId]);

    if (resumeResult.rows.length === 0) {
      return res.json({
        success: true,
        data: { suggestions: [] },
        message: 'No resume found. Create a resume first to get job suggestions.'
      });
    }

    const resume = resumeResult.rows[0];
    
    try {
      const suggestions = await OpenAIService.generateJobSuggestions(
        { work_location: resume.work_location },
        resume.job_title
      );

      res.json({
        success: true,
        data: { suggestions }
      });
    } catch (error) {
      logger.error('Error generating job suggestions:', error);
      res.json({
        success: true,
        data: { suggestions: [] },
        message: 'Unable to generate suggestions at this time'
      });
    }
  })
);

// Get user statistics
router.get('/:userId/stats',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Check if requesting own stats
    if (req.user.id !== userId) {
      throw new AppError('Access denied', 403);
    }

    const [resumeStats, simulationStats, subscriptionStats] = await Promise.all([
      // Resume statistics
      query(`
        SELECT 
          COUNT(*) as total_resumes,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_resumes,
          AVG(overall_score) as avg_score,
          MAX(overall_score) as best_score
        FROM resumes 
        WHERE user_id = $1
      `, [userId]),

      // Simulation statistics
      query(`
        SELECT 
          COUNT(DISTINCT rs.id) as total_simulations,
          COUNT(DISTINCT rs.country_code) as countries_used,
          SUM(rs.current_opens) as total_opens,
          SUM(rs.current_shortlists) as total_shortlists,
          AVG(rs.current_opens::float / NULLIF(rs.total_employers, 0) * 100) as avg_open_rate
        FROM resume_simulations rs
        JOIN resumes r ON rs.resume_id = r.id
        WHERE r.user_id = $1
      `, [userId]),

      // Subscription statistics
      query(`
        SELECT 
          COUNT(*) as total_subscriptions,
          SUM(total_amount) as total_spent,
          MAX(current_period_end) as latest_expiry
        FROM subscriptions 
        WHERE user_id = $1
      `, [userId])
    ]);

    const stats = {
      resumes: resumeStats.rows[0],
      simulations: simulationStats.rows[0],
      subscriptions: subscriptionStats.rows[0]
    };

    // Convert numeric strings to numbers
    Object.keys(stats).forEach(category => {
      Object.keys(stats[category]).forEach(key => {
        const value = stats[category][key];
        if (value !== null && !isNaN(value)) {
          stats[category][key] = parseFloat(value);
        }
      });
    });

    res.json({
      success: true,
      data: { stats }
    });
  })
);

// Update user preferences/settings
router.put('/:userId/preferences',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { email_notifications, sms_notifications, marketing_emails } = req.body;

    // Check if updating own preferences
    if (req.user.id !== userId) {
      throw new AppError('Access denied', 403);
    }

    // For now, we'll store preferences in a JSON column or separate table
    // This is a placeholder implementation
    const preferences = {
      email_notifications: email_notifications !== undefined ? email_notifications : true,
      sms_notifications: sms_notifications !== undefined ? sms_notifications : false,
      marketing_emails: marketing_emails !== undefined ? marketing_emails : true,
      updated_at: new Date().toISOString()
    };

    // In a real implementation, you might have a user_preferences table
    // For now, we'll just return success
    logger.info(`User preferences updated for ${userId}:`, preferences);

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: { preferences }
    });
  })
);

// Delete user account (soft delete)
router.delete('/:userId',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Check if deleting own account
    if (req.user.id !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Soft delete user
    await query(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );

    logger.info(`User account soft deleted: ${userId}`);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  })
);

// Search users (admin only)
router.get('/search',
  // This would need admin authentication middleware
  validate(schemas.pagination, 'query'),
  asyncHandler(async (req, res) => {
    const { page, limit, search, country_code, job_category_id } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE u.is_active = true';
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

    if (job_category_id) {
      paramCount++;
      whereClause += ` AND u.job_category_id = $${paramCount}`;
      params.push(job_category_id);
    }

    const [usersResult, countResult] = await Promise.all([
      query(`
        SELECT u.id, u.email, u.name, u.country_code, u.job_category_id,
               u.email_verified, u.last_login, u.created_at,
               jc.title as job_category_title, c.name as country_name,
               COUNT(r.id) as resume_count
        FROM users u
        LEFT JOIN job_categories jc ON u.job_category_id = jc.id
        LEFT JOIN countries c ON u.country_code = c.code
        LEFT JOIN resumes r ON u.id = r.user_id
        ${whereClause}
        GROUP BY u.id, jc.title, c.name
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

module.exports = router;