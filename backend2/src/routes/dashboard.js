const express = require('express');
const { query } = require('../database/connection');
const { validate, schemas } = require('../utils/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, requireActiveSubscription } = require('../middleware/auth');
const SimulationService = require('../services/simulationService');
const logger = require('../utils/logger');

const router = express.Router();

// Get user dashboard overview
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get user's active subscription
    const subscriptionResult = await query(`
      SELECT s.*, 
             array_agg(
               json_build_object(
                 'country_code', sc.country_code,
                 'country_name', c.name
               )
             ) FILTER (WHERE sc.country_code IS NOT NULL) as countries
      FROM subscriptions s
      LEFT JOIN subscription_countries sc ON s.id = sc.subscription_id AND sc.is_active = true
      LEFT JOIN countries c ON sc.country_code = c.code
      WHERE s.user_id = $1 
      AND s.status = 'active'
      AND s.current_period_end > CURRENT_TIMESTAMP
      GROUP BY s.id
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [userId]);

    // Get resume statistics
    const resumeStats = await query(`
      SELECT 
        COUNT(*) as total_resumes,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_resumes,
        AVG(overall_score) as avg_score,
        MAX(overall_score) as best_score
      FROM resumes 
      WHERE user_id = $1
    `, [userId]);

    // Get active simulations
    const activeSimulations = await query(`
      SELECT rs.*, r.job_title, c.name as country_name,
             dm.opens_count, dm.shortlists_count, dm.progress_percentage, dm.employers_reached
      FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      LEFT JOIN countries c ON rs.country_code = c.code
      LEFT JOIN LATERAL (
        SELECT * FROM dashboard_metrics 
        WHERE simulation_id = rs.id 
        ORDER BY timestamp DESC 
        LIMIT 1
      ) dm ON true
      WHERE r.user_id = $1 AND rs.status = 'running'
      ORDER BY rs.created_at DESC
    `, [userId]);

    // Get recent activity
    const recentActivity = await query(`
      SELECT 'simulation_started' as activity_type, 
             rs.created_at as timestamp,
             json_build_object(
               'resume_id', rs.resume_id,
               'job_title', r.job_title,
               'country_code', rs.country_code,
               'country_name', c.name
             ) as data
      FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      LEFT JOIN countries c ON rs.country_code = c.code
      WHERE r.user_id = $1
      
      UNION ALL
      
      SELECT 'resume_created' as activity_type,
             r.created_at as timestamp,
             json_build_object(
               'resume_id', r.id,
               'job_title', r.job_title,
               'overall_score', r.overall_score
             ) as data
      FROM resumes r
      WHERE r.user_id = $1
      
      ORDER BY timestamp DESC
      LIMIT 10
    `, [userId]);

    const dashboard = {
      subscription: subscriptionResult.rows[0] || null,
      resume_stats: resumeStats.rows[0],
      active_simulations: activeSimulations.rows,
      recent_activity: recentActivity.rows
    };

    // Convert numeric strings to numbers
    Object.keys(dashboard.resume_stats).forEach(key => {
      const value = dashboard.resume_stats[key];
      if (value !== null && !isNaN(value)) {
        dashboard.resume_stats[key] = parseFloat(value);
      }
    });

    res.json({
      success: true,
      data: { dashboard }
    });
  })
);

// Get simulation metrics for a specific resume
router.get('/simulation/:simulationId/metrics',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { simulationId } = req.params;
    const userId = req.user.id;
    const { limit = 50 } = req.query;

    // Verify simulation belongs to user
    const simulationCheck = await query(`
      SELECT rs.id FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      WHERE rs.id = $1 AND r.user_id = $2
    `, [simulationId, userId]);

    if (simulationCheck.rows.length === 0) {
      throw new AppError('Simulation not found', 404);
    }

    // Get simulation details
    const simulationResult = await query(`
      SELECT rs.*, r.job_title, c.name as country_name
      FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      LEFT JOIN countries c ON rs.country_code = c.code
      WHERE rs.id = $1
    `, [simulationId]);

    // Get metrics history
    const metrics = await SimulationService.getDashboardMetrics(simulationId, limit);

    res.json({
      success: true,
      data: {
        simulation: simulationResult.rows[0],
        metrics
      }
    });
  })
);

// Get all simulations for user
router.get('/simulations',
  authenticate,
  validate(schemas.pagination, 'query'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page, limit, status, country_code } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE r.user_id = $1';
    const params = [userId];

    if (status) {
      params.push(status);
      whereClause += ` AND rs.status = $${params.length}`;
    }

    if (country_code) {
      params.push(country_code);
      whereClause += ` AND rs.country_code = $${params.length}`;
    }

    const [simulationsResult, countResult] = await Promise.all([
      query(`
        SELECT rs.*, r.job_title, r.overall_score, c.name as country_name,
               dm.opens_count, dm.shortlists_count, dm.progress_percentage, dm.employers_reached
        FROM resume_simulations rs
        JOIN resumes r ON rs.resume_id = r.id
        LEFT JOIN countries c ON rs.country_code = c.code
        LEFT JOIN LATERAL (
          SELECT * FROM dashboard_metrics 
          WHERE simulation_id = rs.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ) dm ON true
        ${whereClause}
        ORDER BY rs.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
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

// Get simulation statistics summary
router.get('/stats',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const stats = await query(`
      SELECT 
        COUNT(DISTINCT rs.id) as total_simulations,
        COUNT(DISTINCT rs.country_code) as countries_used,
        COUNT(DISTINCT rs.resume_id) as resumes_with_simulations,
        SUM(rs.current_opens) as total_opens,
        SUM(rs.current_shortlists) as total_shortlists,
        SUM(rs.total_employers) as total_employers_reached,
        AVG(rs.current_opens::float / NULLIF(rs.total_employers, 0) * 100) as avg_open_rate,
        AVG(rs.current_shortlists::float / NULLIF(rs.current_opens, 0) * 100) as avg_shortlist_rate,
        COUNT(CASE WHEN rs.status = 'running' THEN 1 END) as active_simulations,
        COUNT(CASE WHEN rs.status = 'completed' THEN 1 END) as completed_simulations
      FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      WHERE r.user_id = $1
    `, [userId]);

    // Get top performing countries
    const topCountries = await query(`
      SELECT rs.country_code, c.name as country_name,
             COUNT(*) as simulation_count,
             SUM(rs.current_opens) as total_opens,
             SUM(rs.current_shortlists) as total_shortlists,
             AVG(rs.current_opens::float / NULLIF(rs.total_employers, 0) * 100) as avg_open_rate
      FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      LEFT JOIN countries c ON rs.country_code = c.code
      WHERE r.user_id = $1
      GROUP BY rs.country_code, c.name
      ORDER BY total_opens DESC
      LIMIT 5
    `, [userId]);

    // Get performance over time (last 30 days)
    const performanceOverTime = await query(`
      SELECT DATE(dm.timestamp) as date,
             SUM(dm.opens_count) as daily_opens,
             SUM(dm.shortlists_count) as daily_shortlists,
             COUNT(DISTINCT dm.simulation_id) as active_simulations
      FROM dashboard_metrics dm
      JOIN resume_simulations rs ON dm.simulation_id = rs.id
      JOIN resumes r ON rs.resume_id = r.id
      WHERE r.user_id = $1 
      AND dm.timestamp >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(dm.timestamp)
      ORDER BY date DESC
    `, [userId]);

    const dashboardStats = {
      overview: stats.rows[0],
      top_countries: topCountries.rows,
      performance_over_time: performanceOverTime.rows
    };

    // Convert numeric strings to numbers
    Object.keys(dashboardStats.overview).forEach(key => {
      const value = dashboardStats.overview[key];
      if (value !== null && !isNaN(value)) {
        dashboardStats.overview[key] = parseFloat(value);
      }
    });

    dashboardStats.top_countries.forEach(country => {
      Object.keys(country).forEach(key => {
        const value = country[key];
        if (value !== null && !isNaN(value) && key !== 'country_code' && key !== 'country_name') {
          country[key] = parseFloat(value);
        }
      });
    });

    res.json({
      success: true,
      data: { stats: dashboardStats }
    });
  })
);

// Pause simulation
router.post('/simulation/:simulationId/pause',
  authenticate,
  requireActiveSubscription,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { simulationId } = req.params;
    const userId = req.user.id;

    // Verify simulation belongs to user
    const simulationCheck = await query(`
      SELECT rs.id FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      WHERE rs.id = $1 AND r.user_id = $2 AND rs.status = 'running'
    `, [simulationId, userId]);

    if (simulationCheck.rows.length === 0) {
      throw new AppError('Active simulation not found', 404);
    }

    await SimulationService.pauseSimulation(simulationId);

    logger.info(`Simulation paused: ${simulationId} by user ${userId}`);

    res.json({
      success: true,
      message: 'Simulation paused successfully'
    });
  })
);

// Resume simulation
router.post('/simulation/:simulationId/resume',
  authenticate,
  requireActiveSubscription,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { simulationId } = req.params;
    const userId = req.user.id;

    // Verify simulation belongs to user
    const simulationCheck = await query(`
      SELECT rs.id FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      WHERE rs.id = $1 AND r.user_id = $2 AND rs.status = 'paused'
    `, [simulationId, userId]);

    if (simulationCheck.rows.length === 0) {
      throw new AppError('Paused simulation not found', 404);
    }

    await SimulationService.resumeSimulation(simulationId);

    logger.info(`Simulation resumed: ${simulationId} by user ${userId}`);

    res.json({
      success: true,
      message: 'Simulation resumed successfully'
    });
  })
);

// Get available countries for new simulations
router.get('/available-countries',
  authenticate,
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get countries user has access to through subscription
    const availableCountries = await query(`
      SELECT c.code, c.name, c.total_employers
      FROM countries c
      JOIN subscription_countries sc ON c.code = sc.country_code
      JOIN subscriptions s ON sc.subscription_id = s.id
      WHERE s.user_id = $1 
      AND s.status = 'active'
      AND s.current_period_end > CURRENT_TIMESTAMP
      AND sc.is_active = true
      AND c.is_active = true
      ORDER BY c.name
    `, [userId]);

    res.json({
      success: true,
      data: { countries: availableCountries.rows }
    });
  })
);

// Get country-specific statistics
router.get('/country/:countryCode/stats',
  authenticate,
  requireActiveSubscription,
  validate(schemas.countryCode, 'params'),
  asyncHandler(async (req, res) => {
    const { countryCode } = req.params;
    const userId = req.user.id;

    // Verify user has access to this country
    const accessCheck = await query(`
      SELECT 1 FROM subscription_countries sc
      JOIN subscriptions s ON sc.subscription_id = s.id
      WHERE s.user_id = $1 
      AND sc.country_code = $2
      AND s.status = 'active'
      AND s.current_period_end > CURRENT_TIMESTAMP
      AND sc.is_active = true
    `, [userId, countryCode]);

    if (accessCheck.rows.length === 0) {
      throw new AppError('Access to this country not found in your subscription', 403);
    }

    // Get country statistics
    const countryStats = await query(`
      SELECT 
        COUNT(*) as total_simulations,
        SUM(rs.current_opens) as total_opens,
        SUM(rs.current_shortlists) as total_shortlists,
        AVG(rs.current_opens::float / NULLIF(rs.total_employers, 0) * 100) as avg_open_rate,
        AVG(rs.current_shortlists::float / NULLIF(rs.current_opens, 0) * 100) as avg_shortlist_rate,
        COUNT(CASE WHEN rs.status = 'running' THEN 1 END) as active_simulations,
        COUNT(CASE WHEN rs.status = 'completed' THEN 1 END) as completed_simulations
      FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      WHERE r.user_id = $1 AND rs.country_code = $2
    `, [userId, countryCode]);

    // Get recent simulations in this country
    const recentSimulations = await query(`
      SELECT rs.*, r.job_title, r.overall_score,
             dm.opens_count, dm.shortlists_count, dm.progress_percentage
      FROM resume_simulations rs
      JOIN resumes r ON rs.resume_id = r.id
      LEFT JOIN LATERAL (
        SELECT * FROM dashboard_metrics 
        WHERE simulation_id = rs.id 
        ORDER BY timestamp DESC 
        LIMIT 1
      ) dm ON true
      WHERE r.user_id = $1 AND rs.country_code = $2
      ORDER BY rs.created_at DESC
      LIMIT 5
    `, [userId, countryCode]);

    const stats = {
      overview: countryStats.rows[0],
      recent_simulations: recentSimulations.rows
    };

    // Convert numeric strings to numbers
    Object.keys(stats.overview).forEach(key => {
      const value = stats.overview[key];
      if (value !== null && !isNaN(value)) {
        stats.overview[key] = parseFloat(value);
      }
    });

    res.json({
      success: true,
      data: { stats }
    });
  })
);

module.exports = router;