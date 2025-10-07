require("dotenv").config(); // load environment variables
const cors = require("cors");
const express = require("express");
const morgan = require("morgan");
const logger = require("./config/logger");
const requestContext = require("./middlewares/requestContext.middleware");
const sequelize = require("./config/sequelize"); // sequelize instance
const router = require("./routes");
const errorHandler = require("./middlewares/errorHandler.middleware");
const passport = require("passport");
require("./config/passport");
const {
  start: startSimulationShortlistCron,
} = require("./jobs/simulationShortlistCron");
const {
  start: startWeeklyCountryCampaign,
} = require("./jobs/weeklyCountryCampaign");
const {
  start: startSubscribedCountryUpdatesCampaign,
} = require("./jobs/subscribedCountryUpdatesCampaign");
const { start: startEmployerScrapeCron } = require("./jobs/employerScrapeCron");

const app = express();

// Middlewares
app.use(cors()); // enable cors
app.use(express.json()); // parse JSON request body
app.use(passport.initialize()); // initialize passport
app.use(requestContext); // attach requestId and per-request logger

// HTTP request logging via morgan -> winston
morgan.token("id", (req) => req.id);
morgan.token("remote-ip", (req) => req.ip);
app.use(
  morgan(
    ':id :method :url :status :res[content-length] - :response-time ms ":user-agent" :remote-ip',
    { stream: logger.stream }
  )
);

app.set("trust proxy", 1);

// Routes
app.use("/api", router);

// Error handling middleware (should be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// Process-level handlers
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", { reason });
});
process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { message: err.message, stack: err.stack });
  // Consider graceful shutdown in production
});
process.on("SIGTERM", () => {
  logger.info("Received SIGTERM. Shutting down gracefully.");
  process.exit(0);
});
process.on("SIGINT", () => {
  logger.info("Received SIGINT. Shutting down gracefully.");
  process.exit(0);
});

async function bootstrap() {
  try {
    await sequelize.authenticate(); // database connection
    logger.info("Database connection established successfully");
    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      // Start background cron tasks once the server is up
      startSimulationShortlistCron();
      startWeeklyCountryCampaign();
      startSubscribedCountryUpdatesCampaign();
      startEmployerScrapeCron();
    });
  } catch (error) {
    logger.error("Unable to connect to the database", { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

bootstrap();
