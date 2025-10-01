const express = require("express");
const router = express.Router();

const authRoute = require("./auth.route");
const lookupRoute = require("./lookup.route");
const userRoute = require("./user.route");
const candidateRoute = require("./candidate.route");
const employerRoute = require("./employer.route");
const countryRoute = require("./country.route");
const emailRoute = require("./email.route");
const adminRoute = require("./admin.route");
const {
  verifyWebhook,
  handleWebhook,
} = require("../controllers/subscription.controller");

router.use("/auth", authRoute);
router.use("/lookup", lookupRoute);
router.use("/user", userRoute);
router.use("/candidate", candidateRoute);
router.use("/employer", employerRoute);
router.use("/countries", countryRoute);
router.use("/email", emailRoute);
router.use("/admin", adminRoute);

router.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Server is running!!!" });
});

// Braintree webhook endpoints (no auth)
router.get("/braintree/webhook", verifyWebhook);
router.post(
  "/braintree/webhook",
  express.urlencoded({ extended: false }),
  handleWebhook
);

module.exports = router;
