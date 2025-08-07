const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { connectDB } = require('./database/connection');
const SimulationService = require('./services/simulationService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const resumeRoutes = require('./routes/resumes');
const employerRoutes = require('./routes/employers');
const dashboardRoutes = require('./routes/dashboard');
const subscriptionRoutes = require('./routes/subscriptions');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://nextmatch.ai',
      'https://www.nextmatch.ai',
      'https://app.nextmatch.ai',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/api/auth/admin/login', authLimiter);

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Raw body parser for Stripe webhooks
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await connectDB();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/employers', employerRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'NextMatch AI Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      resumes: '/api/resumes',
      dashboard: '/api/dashboard',
      subscriptions: '/api/subscriptions',
      employers: '/api/employers',
      admin: '/api/admin'
    }
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Graceful shutdown handler
let server;
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
      
      // Close database connections
      // Note: pg pool will close automatically when process exits
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
  
  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Schedule simulation updates (every 2 hours)
cron.schedule('0 */2 * * *', async () => {
  try {
    logger.info('Starting scheduled simulation update...');
    await SimulationService.updateAllActiveSimulations();
    logger.info('Scheduled simulation update completed');
  } catch (error) {
    logger.error('Scheduled simulation update failed:', error);
  }
});

// Schedule daily cleanup tasks (every day at 2 AM)
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Starting daily cleanup tasks...');
    
    // Clean up old dashboard metrics (keep last 90 days)
    await SimulationService.cleanupOldMetrics(90);
    
    // Clean up expired simulations
    await SimulationService.cleanupExpiredSimulations();
    
    logger.info('Daily cleanup tasks completed');
  } catch (error) {
    logger.error('Daily cleanup tasks failed:', error);
  }
});

// Start server
server = app.listen(PORT, async () => {
  try {
    // Test database connection on startup
    await connectDB();
    logger.info(`✅ Database connection established`);
    
    logger.info(`🚀 NextMatch AI Backend started successfully`);
    logger.info(`📡 Server running on port ${PORT}`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    logger.info(`📚 API docs: http://localhost:${PORT}/`);
    
    // Log scheduled tasks
    logger.info(`⏰ Simulation updates scheduled every 2 hours`);
    logger.info(`🧹 Cleanup tasks scheduled daily at 2 AM`);
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
});

// Export for testing
module.exports = app;