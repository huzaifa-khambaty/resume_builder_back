require("dotenv").config(); // load environment variables

const cors = require("cors");
const express = require("express");
const sequelize = require("./config/sequelize"); // sequelize instance
const router = require("./routes");
const logger = require("./config/logger");
const errorHandler = require("./middlewares/errorHandler.middleware");

const app = express();

// HTTP request logging middleware
app.use((req, res, next) => {
  logger.http(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Middlewares
app.use(cors()); // enable cors
app.use(express.json()); // parse JSON request body

// Routes
app.use("/api", router);

// Error handling middleware (should be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
async function bootstrap() {
  try {
    await sequelize.authenticate(); // database connection
    logger.info("Database connection established successfully");

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Unable to connect to the database:", {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

bootstrap();
