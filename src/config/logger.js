const winston = require("winston");
const path = require("path");
const fs = require("fs");
const DailyRotateFile = require("winston-daily-rotate-file");

const { combine, timestamp, printf, colorize, errors, json, splat, align } =
  winston.format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for console
winston.addColors({
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
});

const isProd = process.env.NODE_ENV === "production";

// Pretty console format for dev
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  splat(),
  align(),
  printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level}] ${message}${rest}`;
  })
);

// JSON format for files and prod
const fileFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

// Ensure logs dir exists
const logsDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const transports = [
  new winston.transports.Console({
    level: isProd ? "info" : "debug",
    handleExceptions: true,
    format: consoleFormat,
  }),
  new DailyRotateFile({
    level: "info",
    dirname: logsDir,
    filename: "app-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
    format: fileFormat,
  }),
  new DailyRotateFile({
    level: "error",
    dirname: logsDir,
    filename: "error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "30d",
    format: fileFormat,
  }),
];

const logger = winston.createLogger({
  level: isProd ? "info" : "debug",
  levels,
  transports,
  exitOnError: false,
  defaultMeta: { service: "resume-builder-backend" },
});

// Morgan stream support
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
