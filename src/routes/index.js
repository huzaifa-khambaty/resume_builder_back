const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");
const countriesRoute = require("./countries.route");

router.use("/auth", authRoute);
router.use("/countries", countriesRoute);
router.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running!!!" });
});

module.exports = router;
