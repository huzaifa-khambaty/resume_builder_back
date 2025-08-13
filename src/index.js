require("dotenv").config(); // load environment variables

const cors = require("cors");
const express = require("express");
const sequelize = require("./config/sequelize"); // sequelize instance
const router = require("./routes");
const errorHandler = require("./middlewares/errorHandler.middleware");
const passport = require("passport");
require("./config/passport");

const app = express();

// Middlewares
app.use(cors()); // enable cors
app.use(express.json()); // parse JSON request body
app.use(passport.initialize());
// app.use(passport.session());

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
    });
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    process.exit(1);
  }
}

bootstrap();
