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
  addCountries,
  removeCountries,
  getActiveSubscriptionSummary,
  getSubscriptionCountryLists,
} = require("../controllers/subscription.controller");

// Get active subscription plans
router.get("/plans", checkAuth, getActivePlans);

// Calculate subscription pricing
router.post("/calculate", checkAuth, calculatePricing);

// Get payment publishable key (Stripe)
router.get("/client-token", checkAuth, getClientToken);

// Create subscription
router.post("/", checkAuth, createSubscription);

// Get candidate's subscriptions
router.get("/", checkAuth, getMySubscriptions);

// Get specific subscription
router.get("/:subscriptionId", checkAuth, getSubscription);

// Cancel subscription
router.delete("/:subscriptionId", checkAuth, cancelMySubscription);

// Add countries to a subscription
router.post( "/:subscriptionId/add-countries", checkAuth, addCountries );

// Remove countries from a subscription
router.delete( "/:subscriptionId/countries", checkAuth, removeCountries );

// Convenience endpoints for front-end simplification
router.get("/active/summary", checkAuth, getActiveSubscriptionSummary);
router.get("/:subscriptionId/country-lists", checkAuth, getSubscriptionCountryLists);

module.exports = router;
