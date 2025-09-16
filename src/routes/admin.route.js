const express = require("express");
const router = express.Router();
// Assuming admin auth middleware exists or we'll use the same one
const { checkAdminAuth } = require("../middlewares/auth.middleware");
const {
  getAllPlans,
  createPlan,
  updatePlan,
  getAllSubscriptions,
  cancelAnySubscription,
} = require("../controllers/subscription.controller");

// Subscription Plans Management
router.get("/subscription-plans", checkAdminAuth, getAllPlans);
router.post("/subscription-plans", checkAdminAuth, createPlan);
router.put("/subscription-plans/:planId", checkAdminAuth, updatePlan);

// Subscriptions Management
router.get("/subscriptions", checkAdminAuth, getAllSubscriptions);
router.delete(
  "/subscriptions/:subscriptionId",
  checkAdminAuth,
  cancelAnySubscription
);

module.exports = router;
