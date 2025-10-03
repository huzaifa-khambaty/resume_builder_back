const baseLogger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  const requestId = req.id;
  const logger = req.logger || baseLogger;

  // Log the error with Winston
  logger.error("Request error", {
    requestId,
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Determine status code and message
  const status = err.status || 500;
  const message = err.message || "Internal Server Error";

  const body = {
    error: {
      message,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
    requestId,
  };

  res.status(status).json(body);
};

module.exports = errorHandler;
