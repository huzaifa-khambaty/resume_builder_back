const express = require("express");
const router = express.Router();
const { checkAuth } = require("../middlewares/auth.middleware");
const {
  getActivePlans,
  calculatePricing,
  getClientToken,
  createSubscription,
  getMySubscriptions,
  getSubscription,
  cancelMySubscription,
} = require("../controllers/subscription.controller");

// Get active subscription plans
router.get("/plans", checkAuth, getActivePlans);

// Calculate subscription pricing
router.post("/calculate", checkAuth, calculatePricing);

// Get Braintree client token
router.get("/client-token", checkAuth, getClientToken);

// Create subscription
router.post("/", checkAuth, createSubscription);

// Get candidate's subscriptions
router.get("/", checkAuth, getMySubscriptions);

// Get specific subscription
router.get("/:subscriptionId", checkAuth, getSubscription);

// Cancel subscription
router.delete("/:subscriptionId", checkAuth, cancelMySubscription);

module.exports = router;
