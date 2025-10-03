const { v4: uuidv4 } = require("uuid");
const logger = require("../config/logger");

// Attaches a stable requestId and a child logger to each request
module.exports = function requestContext(req, res, next) {
  const requestId = req.headers["x-request-id"] || uuidv4();
  req.id = requestId;

  // Build a child logger with useful per-request metadata
  req.logger = logger.child({
    requestId,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Expose requestId to responses for troubleshooting
  res.setHeader("X-Request-Id", requestId);
  next();
};
