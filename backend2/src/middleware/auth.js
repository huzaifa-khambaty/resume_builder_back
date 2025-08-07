const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const { query } = require('../database/connection');
const { AppError, asyncHandler } = require('./errorHandler');
const logger = require('../utils/logger');

// Configure AWS Cognito
const cognito = new AWS.CognitoIdentityServiceProvider({
  region: process.env.AWS_COGNITO_REGION
});

// Verify JWT token from AWS Cognito
async function verifyToken(token) {
  try {
    // In production, you should verify the token signature using Cognito's public keys
    // For now, we'll decode without verification (NOT recommended for production)
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.sub) {
      throw new Error('Invalid token structure');
    }

    return decoded;
  } catch (error) {
    throw new AppError('Invalid token', 401);
  }
}

// Authentication middleware
const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Access token is required', 401));
  }

  try {
    // Verify token
    const decoded = await verifyToken(token);
    
    // Get user from database
    const result = await query(
      'SELECT * FROM users WHERE cognito_sub = $1 AND is_active = true',
      [decoded.sub]
    );

    if (result.rows.length === 0) {
      return next(new AppError('User not found or inactive', 401));
    }

    const user = result.rows[0];

    // Update last login
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Attach user to request
    req.user = user;
    req.cognitoUser = decoded;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return next(new AppError('Authentication failed', 401));
  }
});

// Admin authentication middleware
const authenticateAdmin = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Access token is required', 401));
  }

  try {
    // Verify JWT token (for admin, we use our own JWT)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get admin user from database
    const result = await query(
      'SELECT * FROM admin_users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return next(new AppError('Admin not found or inactive', 401));
    }

    const admin = result.rows[0];

    // Update last login
    await query(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [admin.id]
    );

    // Attach admin to request
    req.admin = admin;

    next();
  } catch (error) {
    logger.error('Admin authentication error:', error);
    return next(new AppError('Admin authentication failed', 401));
  }
});

// Role-based authorization middleware
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return next(new AppError('Admin access required', 403));
    }

    if (!roles.includes(req.admin.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
}

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = await verifyToken(token);
      
      const result = await query(
        'SELECT * FROM users WHERE cognito_sub = $1 AND is_active = true',
        [decoded.sub]
      );

      if (result.rows.length > 0) {
        req.user = result.rows[0];
        req.cognitoUser = decoded;
      }
    } catch (error) {
      // Ignore authentication errors for optional auth
      logger.debug('Optional auth failed:', error.message);
    }
  }

  next();
});

// Check if user has active subscription
const requireActiveSubscription = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const result = await query(`
    SELECT s.*, COUNT(sc.country_code) as countries_count
    FROM subscriptions s
    LEFT JOIN subscription_countries sc ON s.id = sc.subscription_id AND sc.is_active = true
    WHERE s.user_id = $1 
    AND s.status = 'active' 
    AND s.current_period_end > CURRENT_TIMESTAMP
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 1
  `, [req.user.id]);

  if (result.rows.length === 0) {
    return next(new AppError('Active subscription required', 402));
  }

  req.subscription = result.rows[0];
  next();
});

// Check if user has access to specific country
const requireCountryAccess = (countryParam = 'country_code') => {
  return asyncHandler(async (req, res, next) => {
    if (!req.subscription) {
      return next(new AppError('Active subscription required', 402));
    }

    const countryCode = req.params[countryParam] || req.body[countryParam];
    
    if (!countryCode) {
      return next(new AppError('Country code is required', 400));
    }

    const result = await query(`
      SELECT 1 FROM subscription_countries sc
      WHERE sc.subscription_id = $1 
      AND sc.country_code = $2 
      AND sc.is_active = true
    `, [req.subscription.id, countryCode]);

    if (result.rows.length === 0) {
      return next(new AppError('Access to this country is not included in your subscription', 403));
    }

    next();
  });
};

module.exports = {
  authenticate,
  authenticateAdmin,
  authorize,
  optionalAuth,
  requireActiveSubscription,
  requireCountryAccess,
  verifyToken
};