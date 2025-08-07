const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  // Log the error with Winston
  logger.error("Error occurred:", {
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

  // Customize response based on environment
  if (process.env.NODE_ENV === "production") {
    res.status(status).json({ error: { message } });
  } else {
    res.status(status).json({ error: { message, stack: err.stack } });
  }
};

module.exports = errorHandler;
