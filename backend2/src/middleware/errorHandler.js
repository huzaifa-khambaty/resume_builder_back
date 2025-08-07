const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
function errorHandler(err, req, res, next) {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value: ${value}. Please use another value!`;
    error = new AppError(message, 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(val => val.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    error = new AppError(message, 400);
  }

  // PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        error = new AppError('Duplicate entry. This record already exists.', 409);
        break;
      case '23503': // Foreign key violation
        error = new AppError('Referenced record does not exist.', 400);
        break;
      case '23502': // Not null violation
        error = new AppError('Required field is missing.', 400);
        break;
      case '22001': // String data too long
        error = new AppError('Input data is too long.', 400);
        break;
      default:
        error = new AppError('Database error occurred.', 500);
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please log in again.', 401);
  }

  if (err.name === 'TokenExpiredError') {
    error = new AppError('Your token has expired. Please log in again.', 401);
  }

  // AWS Cognito errors
  if (err.code === 'NotAuthorizedException') {
    error = new AppError('Invalid credentials.', 401);
  }

  if (err.code === 'UserNotFoundException') {
    error = new AppError('User not found.', 404);
  }

  if (err.code === 'UserNotConfirmedException') {
    error = new AppError('Please verify your email address.', 400);
  }

  // Stripe errors
  if (err.type === 'StripeCardError') {
    error = new AppError('Payment failed. Please check your card details.', 400);
  }

  if (err.type === 'StripeInvalidRequestError') {
    error = new AppError('Invalid payment request.', 400);
  }

  // OpenAI errors
  if (err.response && err.response.status === 429) {
    error = new AppError('AI service is temporarily unavailable. Please try again later.', 503);
  }

  // Default to 500 server error
  if (!error.statusCode) {
    error.statusCode = 500;
    error.message = 'Something went wrong!';
  }

  // Send error response
  const response = {
    success: false,
    message: error.message
  };

  // Include error details in development
  if (process.env.NODE_ENV === 'development') {
    response.error = err;
    response.stack = err.stack;
  }

  res.status(error.statusCode).json(response);
}

// Async error handler wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 handler
function notFound(req, res, next) {
  const error = new AppError(`Not found - ${req.originalUrl}`, 404);
  next(error);
}

module.exports = {
  AppError,
  errorHandler,
  asyncHandler,
  notFound
};