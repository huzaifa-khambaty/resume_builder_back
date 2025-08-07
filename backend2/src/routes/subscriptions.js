const express = require('express');
const { query, transaction } = require('../database/connection');
const { validate, schemas } = require('../utils/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, requireActiveSubscription } = require('../middleware/auth');
const PaymentService = require('../services/paymentService');
const SimulationService = require('../services/simulationService');
const logger = require('../utils/logger');

const router = express.Router();

// Get subscription pricing and available countries
router.get('/pricing',
  asyncHandler(async (req, res) => {
    const countries = await query(`
      SELECT code, name, total_employers
      FROM countries 
      WHERE is_active = true 
      ORDER BY name
    `);

    const pricing = {
      price_per_country: 1.99,
      currency: 'USD',
      billing_cycle_months: 6,
      available_countries: countries.rows
    };

    res.json({
      success: true,
      data: { pricing }
    });
  })
);

// Create payment intent for new subscription
router.post('/create-payment-intent',
  authenticate,
  validate(schemas.subscription),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { countries_count, country_codes } = req.body;

    // Validate country codes
    const countryCheck = await query(`
      SELECT code FROM countries 
      WHERE code = ANY($1) AND is_active = true
    `, [country_codes]);

    if (countryCheck.rows.length !== country_codes.length) {
      throw new AppError('One or more invalid country codes', 400);
    }

    // Check if user already has an active subscription
    const existingSubscription = await PaymentService.getUserSubscription(userId);
    if (existingSubscription) {
      throw new AppError('You already have an active subscription. Use upgrade instead.', 409);
    }

    const paymentIntent = await PaymentService.createPaymentIntent(
      userId,
      countries_count,
      country_codes
    );

    res.json({
      success: true,
      message: 'Payment intent created successfully',
      data: {
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      }
    });
  })
);

// Confirm subscription after successful payment
router.post('/confirm',
  authenticate,
  asyncHandler(async (req, res) => {
    const { payment_intent_id } = req.body;

    if (!payment_intent_id) {
      throw new AppError('Payment intent ID is required', 400);
    }

    const subscription = await PaymentService.createSubscription(payment_intent_id);

    logger.info(`Subscription confirmed: ${subscription.id} for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Subscription created successfully',
      data: { subscription }
    });
  })
);

// Get user's current subscription
router.get('/current',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const subscription = await PaymentService.getUserSubscription(userId);

    res.json({
      success: true,
      data: { subscription }
    });
  })
);

// Get subscription history
router.get('/history',
  authenticate,
  validate(schemas.pagination, 'query'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { limit } = req.query;

    const subscriptions = await PaymentService.getPaymentHistory(userId, limit);

    res.json({
      success: true,
      data: { subscriptions }
    });
  })
);

// Upgrade subscription (add more countries)
router.post('/upgrade',
  authenticate,
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { additional_countries } = req.body;

    if (!additional_countries || !Array.isArray(additional_countries) || additional_countries.length === 0) {
      throw new AppError('Additional countries are required', 400);
    }

    // Validate country codes
    const countryCheck = await query(`
      SELECT code FROM countries 
      WHERE code = ANY($1) AND is_active = true
    `, [additional_countries]);

    if (countryCheck.rows.length !== additional_countries.length) {
      throw new AppError('One or more invalid country codes', 400);
    }

    // Check if user already has access to these countries
    const existingAccess = await query(`
      SELECT sc.country_code
      FROM subscription_countries sc
      JOIN subscriptions s ON sc.subscription_id = s.id
      WHERE s.user_id = $1 
      AND sc.country_code = ANY($2)
      AND s.status = 'active'
      AND s.current_period_end > CURRENT_TIMESTAMP
      AND sc.is_active = true
    `, [userId, additional_countries]);

    if (existingAccess.rows.length > 0) {
      const existingCountries = existingAccess.rows.map(row => row.country_code);
      throw new AppError(`You already have access to: ${existingCountries.join(', ')}`, 409);
    }

    const paymentIntent = await PaymentService.upgradeSubscription(userId, additional_countries);

    res.json({
      success: true,
      message: 'Upgrade payment intent created successfully',
      data: {
        client_secret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      }
    });
  })
);

// Confirm subscription upgrade
router.post('/upgrade/confirm',
  authenticate,
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const { payment_intent_id } = req.body;

    if (!payment_intent_id) {
      throw new AppError('Payment intent ID is required', 400);
    }

    await PaymentService.processUpgrade(payment_intent_id);

    logger.info(`Subscription upgraded for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Subscription upgraded successfully'
    });
  })
);

// Cancel subscription
router.post('/cancel',
  authenticate,
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const subscriptionId = req.subscription.id;

    await PaymentService.cancelSubscription(subscriptionId, userId);

    logger.info(`Subscription canceled: ${subscriptionId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period'
    });
  })
);

// Start simulation (requires active subscription)
router.post('/simulate',
  authenticate,
  requireActiveSubscription,
  validate(schemas.simulationTrigger),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { resume_id, country_code } = req.body;

    // Verify resume belongs to user
    const resumeCheck = await query(
      'SELECT id, is_paid, status FROM resumes WHERE id = $1 AND user_id = $2',
      [resume_id, userId]
    );

    if (resumeCheck.rows.length === 0) {
      throw new AppError('Resume not found', 404);
    }

    const resume = resumeCheck.rows[0];

    if (resume.status !== 'uploaded' && resume.status !== 'active') {
      throw new AppError('Resume must be uploaded before starting simulation', 400);
    }

    // Verify user has access to the country
    const hasAccess = await PaymentService.validateCountryAccess(userId, country_code);
    if (!hasAccess) {
      throw new AppError('Access to this country is not included in your subscription', 403);
    }

    // Check if simulation already exists for this resume and country
    const existingSimulation = await query(`
      SELECT id, status FROM resume_simulations 
      WHERE resume_id = $1 AND country_code = $2 AND status IN ('running', 'paused')
    `, [resume_id, country_code]);

    if (existingSimulation.rows.length > 0) {
      throw new AppError('Simulation already running for this resume in this country', 409);
    }

    // Create simulation
    const simulation = await SimulationService.createSimulation(
      resume_id,
      req.subscription.id,
      country_code
    );

    // Update resume status
    await query(
      'UPDATE resumes SET status = $1, is_paid = true WHERE id = $2',
      ['active', resume_id]
    );

    logger.info(`Simulation started: ${simulation.id} for resume ${resume_id} in ${country_code}`);

    res.json({
      success: true,
      message: 'Simulation started successfully',
      data: { simulation }
    });
  })
);

// Get subscription usage statistics
router.get('/usage',
  authenticate,
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const subscriptionId = req.subscription.id;

    // Get usage statistics
    const usage = await query(`
      SELECT 
        sc.country_code,
        c.name as country_name,
        COUNT(rs.id) as simulations_count,
        SUM(rs.current_opens) as total_opens,
        SUM(rs.current_shortlists) as total_shortlists,
        MAX(rs.last_updated) as last_simulation
      FROM subscription_countries sc
      LEFT JOIN countries c ON sc.country_code = c.code
      LEFT JOIN resume_simulations rs ON sc.country_code = rs.country_code 
        AND rs.resume_id IN (SELECT id FROM resumes WHERE user_id = $1)
      WHERE sc.subscription_id = $2 AND sc.is_active = true
      GROUP BY sc.country_code, c.name
      ORDER BY c.name
    `, [userId, subscriptionId]);

    // Get subscription details
    const subscriptionDetails = await query(`
      SELECT s.*, 
             COUNT(sc.country_code) as total_countries,
             EXTRACT(DAYS FROM (s.current_period_end - CURRENT_TIMESTAMP)) as days_remaining
      FROM subscriptions s
      LEFT JOIN subscription_countries sc ON s.id = sc.subscription_id AND sc.is_active = true
      WHERE s.id = $1
      GROUP BY s.id
    `, [subscriptionId]);

    const usageData = {
      subscription_details: subscriptionDetails.rows[0],
      country_usage: usage.rows
    };

    // Convert numeric strings to numbers
    usageData.country_usage.forEach(country => {
      Object.keys(country).forEach(key => {
        const value = country[key];
        if (value !== null && !isNaN(value) && key !== 'country_code' && key !== 'country_name') {
          country[key] = parseInt(value);
        }
      });
    });

    res.json({
      success: true,
      data: { usage: usageData }
    });
  })
);

// Webhook endpoint for Stripe
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];

    try {
      await PaymentService.handleWebhook(req.body, signature);
      res.json({ received: true });
    } catch (error) {
      logger.error('Webhook error:', error);
      res.status(400).json({ error: 'Webhook error' });
    }
  })
);

// Get available upgrade options
router.get('/upgrade-options',
  authenticate,
  requireActiveSubscription,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Get countries user doesn't have access to
    const availableCountries = await query(`
      SELECT c.code, c.name, c.total_employers
      FROM countries c
      WHERE c.is_active = true
      AND c.code NOT IN (
        SELECT sc.country_code
        FROM subscription_countries sc
        JOIN subscriptions s ON sc.subscription_id = s.id
        WHERE s.user_id = $1 
        AND s.status = 'active'
        AND s.current_period_end > CURRENT_TIMESTAMP
        AND sc.is_active = true
      )
      ORDER BY c.name
    `, [userId]);

    const upgradeOptions = {
      price_per_country: 1.99,
      currency: 'USD',
      available_countries: availableCountries.rows
    };

    res.json({
      success: true,
      data: { upgrade_options: upgradeOptions }
    });
  })
);

// Reactivate canceled subscription
router.post('/reactivate',
  authenticate,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Find canceled subscription that hasn't expired yet
    const canceledSubscription = await query(`
      SELECT * FROM subscriptions 
      WHERE user_id = $1 
      AND status = 'active'
      AND cancel_at_period_end = true
      AND current_period_end > CURRENT_TIMESTAMP
      ORDER BY created_at DESC
      LIMIT 1
    `, [userId]);

    if (canceledSubscription.rows.length === 0) {
      throw new AppError('No canceled subscription found that can be reactivated', 404);
    }

    const subscription = canceledSubscription.rows[0];

    // Reactivate subscription
    await query(`
      UPDATE subscriptions 
      SET cancel_at_period_end = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [subscription.id]);

    logger.info(`Subscription reactivated: ${subscription.id} for user ${userId}`);

    res.json({
      success: true,
      message: 'Subscription reactivated successfully'
    });
  })
);

module.exports = router;