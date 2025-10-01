require("dotenv").config(); // load environment variables
const cors = require("cors");
const express = require("express");
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

const app = express();

// Middlewares
app.use(cors()); // enable cors
app.use(express.json()); // parse JSON request body
app.use(passport.initialize()); // initialize passport

app.set("trust proxy", 1);

// Routes
app.use("/api", router);

// Error handling middleware (should be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
async function bootstrap() {
  try {
    await sequelize.authenticate(); // database connection
    console.log("Database connection established successfully");
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      // Start background cron tasks once the server is up
      startSimulationShortlistCron();
      startWeeklyCountryCampaign();
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
}

bootstrap();
