const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");
const lookupRoute = require("./lookup.route");
const userRoute = require("./user.route");
const candidateRoute = require("./candidate.route");
const employerRoute = require("./employer.route");
const countryRoute = require("./country.route");

router.use("/auth", authRoute);
router.use("/lookup", lookupRoute);
router.use("/user", userRoute);
router.use("/candidate", candidateRoute);
router.use("/employer", employerRoute);
router.use("/countries", countryRoute);

router.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running!!!" });
});

module.exports = router;
