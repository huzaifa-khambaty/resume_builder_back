const winston = require("winston");
const path = require("path");
const fs = require("fs");
const { combine, timestamp, printf, colorize, errors, json, prettyPrint } =
  winston.format;

// Custom transport to prepend logs to file
class PrependFileTransport extends winston.Transport {
  constructor(options) {
    super(options);
    this.filename = options.filename;
    this.level = options.level;
    this.format = options.format;
  }

  log(info, callback) {
    const formattedMessage = this.format.transform(info);
    const logEntry = JSON.stringify(formattedMessage) + ",\n";

    fs.readFile(this.filename, "utf8", (err, data) => {
      let newContent = logEntry;
      if (!err && data) {
        newContent += data;
      }

      fs.writeFile(this.filename, newContent, (err) => {
        if (err) return callback(err);
        callback(null, true);
      });
    });
  }
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

// Formats
const consoleFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  colorize({ all: true }),
  printf((info) => {
    const { timestamp, level, message, ...args } = info;
    let logMessage = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(args).length > 0) {
      logMessage += ` ${JSON.stringify(args, null, 2)}`;
    }
    return logMessage;
  })
);

const fileFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  json(),
  prettyPrint()
);

// Create logs directory
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Initialize empty log files if they don't exist
const errorLogPath = path.join(logsDir, "error.log");

[errorLogPath].forEach((file) => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "[\n]", "utf8");
  }
});

// Transports
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
    handleExceptions: true,
  }),

  new PrependFileTransport({
    filename: errorLogPath,
    level: "error",
    format: fileFormat,
    handleExceptions: true,
  }),
];

// Logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "debug",
  levels,
  transports,
  exitOnError: false,
});

// Morgan stream
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
