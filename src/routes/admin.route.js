const express = require("express");
const router = express.Router();
// Assuming admin auth middleware exists or we'll use the same one
const { checkAdminAuth } = require("../middlewares/auth.middleware");
const { getDashboardStats } = require("../controllers/admin.controller");
const {
  getAllPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  getAllSubscriptions,
  cancelAnySubscription,
} = require("../controllers/subscription.controller");

// Admin Dashboard
router.get("/dashboard", checkAdminAuth, getDashboardStats);

// Subscription Plans Management
router.get("/subscription-plans", checkAdminAuth, getAllPlans);
router.get("/subscription-plans/:planId", checkAdminAuth, getPlan);
router.post("/subscription-plans", checkAdminAuth, createPlan);
router.put("/subscription-plans/:planId", checkAdminAuth, updatePlan);
router.delete("/subscription-plans/:planId", checkAdminAuth, deletePlan);

// Subscriptions Management
router.get("/subscriptions", checkAdminAuth, getAllSubscriptions);
router.delete(
  "/subscriptions/:subscriptionId",
  checkAdminAuth,
  cancelAnySubscription
);

module.exports = router;
