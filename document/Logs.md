# Logging Guide

This document explains the logging mechanisms implemented in the backend. It covers where logs go, how they are structured, how to correlate request logs, and how to extend the setup.

## Overview

- **Logger**: Winston (`src/config/logger.js`)
- **HTTP logging**: Morgan piped to Winston (`src/index.js`)
- **Request context**: `requestId` and per-request child logger (`src/middlewares/requestContext.middleware.js`)
- **Error handling**: Centralized (`src/middlewares/errorHandler.middleware.js`)
- **Rotation**: Daily rotating log files via `winston-daily-rotate-file`
- **Process safety**: Handlers for unhandled rejections, uncaught exceptions, and termination signals (`src/index.js`)

## Log Files and Locations

- Application logs: `logs/app-YYYY-MM-DD.log`
- Error logs: `logs/error-YYYY-MM-DD.log`
- Console output in development uses a human-friendly colorized format.

Rotation settings (per `src/config/logger.js`):
- Daily rotation (`%DATE%` = day)
- Gzipped archives
- `maxSize: 20m`
- `maxFiles: app: 14d`, `error: 30d`

## Log Levels

Defined in `src/config/logger.js`:
- `error` – Failures and exceptions
- `warn` – Suspicious or degraded conditions
- `info` – High-level application flow, startup, shutdown, key events
- `http` – HTTP access logs (Morgan) routed through Winston
- `debug` – Detailed diagnostics (enabled in development)

Effective base level:
- Development (`NODE_ENV !== 'production'`): `debug`
- Production (`NODE_ENV === 'production'`): `info`

## Request Context and Correlation IDs

Middleware: `src/middlewares/requestContext.middleware.js`
- Reads `X-Request-Id` from incoming requests or generates a UUID.
- Attaches `req.id` and `req.logger = baseLogger.child({ requestId, ip, userAgent })`.
- Adds `X-Request-Id` header to every response for traceability.

Usage pattern in handlers/services:
```js
// Prefer the request-scoped logger when available
const log = req.logger || require("../config/logger");
log.info("Starting operation", { resourceId });
```

## HTTP Access Logs (Morgan)

Configured in `src/index.js`:
- Format: `:id :method :url :status :res[content-length] - :response-time ms ":user-agent" :remote-ip`
- Stream: `logger.stream` sends lines at `http` level into Winston.

These logs include the `requestId`, enabling correlation with application and error logs.

## Centralized Error Handling

Middleware: `src/middlewares/errorHandler.middleware.js`
- Uses `req.logger` (or base logger) to log errors with:
  - `requestId`, `message`, `stack`, `url`, `method`, `ip`, `userAgent`
- Response body includes:
  - `error.message` (and `error.stack` only in non-production)
  - `requestId` for client-side correlation

## Process-Level Event Logging

Configured in `src/index.js`:
- `unhandledRejection` – logs the reason
- `uncaughtException` – logs message and stack (consider graceful shutdown in prod)
- `SIGINT`/`SIGTERM` – logs shutdown intent (used by container orchestration)

## Environment Behavior

- `NODE_ENV=production`:
  - Console logs use JSON format via file formatter, log level `info`
  - Error responses do not include stack traces
- Non-production:
  - Console logs are colorized and aligned
  - Error responses include stack traces for debugging

## Adding Logs in Code

- Use request-scoped logger in handlers/controllers:
```js
const log = req.logger || baseLogger;
log.info("Candidate profile updated", { candidateId });
```

- Use base logger in background jobs/services (no `req` object):
```js
const logger = require("../config/logger");
const jobLogger = logger.child({ job: "weeklyCountryCampaign" });
jobLogger.info("Job started");
```

- Avoid logging sensitive data (PII, secrets, tokens). Mask or omit:
```js
log.warn("Token validation failed", { token: "***masked***" });
```

## Correlating Logs

- Grab the `X-Request-Id` from a client response or access log line.
- Search across app and error logs for that `requestId` to trace the full flow.

Example query (Linux/macOS):
```bash
grep '"requestId":"<your-id>"' logs/app-*.log logs/error-*.log
```

## Extending/Shipping Logs

- Add new transports in `src/config/logger.js` to ship logs to:
  - Datadog, Elastic/ELK, Loki/Grafana, CloudWatch, Stackdriver
- Recommended approach: keep JSON structure and include useful metadata (`service`, `env`, `version`).

## Troubleshooting

- No logs written to files:
  - Check `logs/` directory permissions and ensure the app can write.
  - Verify `winston-daily-rotate-file` is installed.
- Too verbose in production:
  - Ensure `NODE_ENV=production`.
- Missing requestId in logs:
  - Confirm `requestContext` middleware is mounted before routes in `src/index.js`.
- Large log volume:
  - Tune Morgan format, set higher base level, or increase `maxSize`/decrease `maxFiles`.

## References

- `src/config/logger.js`
- `src/index.js`
- `src/middlewares/requestContext.middleware.js`
- `src/middlewares/errorHandler.middleware.js`
