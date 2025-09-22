const {
  getAllSubscriptionPlans,
  getActiveSubscriptionPlans,
  getSubscriptionPlanById,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  calculateSubscriptionPricing,
  createCandidateSubscription,
  getCandidateSubscriptions,
  getSubscriptionById,
  cancelSubscription,
} = require("../services/subscription.service");
const braintreeService = require("../services/braintree.service");
const logger = require("../config/logger");
const { getValidationErrorMessage } = require("../utils/errorHelper");
const {
  validateCreateSubscriptionPlan,
  validateUpdateSubscriptionPlan,
  validateCalculateSubscriptionPricing,
  validateCreateSubscription,
  validateAddCountriesToSubscription,
} = require("../validations/subscription.validation");

// Admin Controllers

/**
 * Get all subscription plans (Admin)
 * GET /api/admin/subscription-plans
 */
async function getAllPlans(req, res) {
  try {
    const { page, limit, search, sortBy, sortOrder, is_active } = req.query;

    const result = await getAllSubscriptionPlans({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      is_active: is_active !== undefined ? is_active === "true" : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "Subscription plans retrieved successfully",
      ...result,
    });
  } catch (error) {
    logger?.error?.("getAllPlans error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve subscription plans",
      error: error.message,
    });
  }
}

/**
 * Create subscription plan (Admin)
 * POST /api/admin/subscription-plans
 */
async function createPlan(req, res) {
  try {
    const { name, description, duration_days, price_per_country, is_active } =
      req.body;

    // Basic validation
    if (!name || !duration_days || !price_per_country) {
      return res.status(400).json({
        success: false,
        message: "Name, duration_days, and price_per_country are required",
      });
    }

    if (duration_days <= 0 || price_per_country < 0) {
      return res.status(400).json({
        success: false,
        message:
          "Duration days must be positive and price must be non-negative",
      });
    }

    // Get admin ID from the authenticated admin
    const adminId = req.admin?.user_id;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const plan = await createSubscriptionPlan(
      {
        name,
        description,
        duration_days: parseInt(duration_days),
        price_per_country: parseFloat(price_per_country),
        is_active: is_active !== undefined ? is_active : true,
      },
      adminId
    );

    return res.status(201).json({
      success: true,
      message: "Subscription plan created successfully",
      data: plan,
    });
  } catch (error) {
    logger?.error?.("createPlan error", { error: error.message });
    const status = error.name === "SequelizeUniqueConstraintError" ? 409 : 500;
    return res.status(status).json({
      success: false,
      message:
        error.name === "SequelizeUniqueConstraintError"
          ? "A plan with this name already exists"
          : "Failed to create subscription plan",
      error: error.message,
    });
  }
}

/**
 * Update subscription plan (Admin)
 * PUT /api/admin/subscription-plans/:planId
 */
async function updatePlan(req, res) {
  try {
    const { planId } = req.params;
    const { name, description, duration_days, price_per_country, is_active } =
      req.body;

    // Get admin ID from the authenticated admin
    const adminId = req.admin?.user_id;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (duration_days !== undefined) {
      if (duration_days <= 0) {
        return res.status(400).json({
          success: false,
          message: "Duration days must be positive",
        });
      }
      updateData.duration_days = parseInt(duration_days);
    }
    if (price_per_country !== undefined) {
      if (price_per_country < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be non-negative",
        });
      }
      updateData.price_per_country = parseFloat(price_per_country);
    }
    if (is_active !== undefined) updateData.is_active = is_active;

    const plan = await updateSubscriptionPlan(planId, updateData, adminId);

    return res.status(200).json({
      success: true,
      message: "Subscription plan updated successfully",
      data: plan,
    });
  } catch (error) {
    logger?.error?.("updatePlan error", error);

    // Handle Sequelize validation errors
    if (error.name === "SequelizeValidationError") {
      const validationErrors = error.errors.map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }));
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      });
    }

    // Handle unique constraint errors
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors[0]?.path || "field";
      const value = error.errors[0]?.value || "value";
      return res.status(409).json({
        success: false,
        message: `A subscription plan with this ${field} already exists: ${value}`,
        error: "Duplicate entry",
      });
    }

    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to update subscription plan",
    });
  }
}

// Candidate Controllers

/**
 * Get active subscription plans (Candidate)
 * GET /api/candidate/subscription-plans
 */
async function getActivePlans(req, res) {
  try {
    const plans = await getActiveSubscriptionPlans();

    return res.status(200).json({
      success: true,
      message: "Active subscription plans retrieved successfully",
      data: plans,
    });
  } catch (error) {
    logger?.error?.("getActivePlans error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve subscription plans",
      error: error.message,
    });
  }
}

/**
 * Calculate subscription pricing (Candidate)
 * POST /api/candidate/subscriptions/calculate
 */
async function calculatePricing(req, res) {
  try {
    const { plan_id, country_ids } = req.body;
    const candidateId = req.candidate.candidate_id;

    if (
      !plan_id ||
      !country_ids ||
      !Array.isArray(country_ids) ||
      country_ids.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "plan_id and country_ids array are required",
      });
    }

    const pricingResult = await calculateSubscriptionPricing(
      plan_id,
      country_ids,
      candidateId
    );

    return res.status(200).json({
      success: true,
      message: "Subscription pricing calculated successfully",
      data: pricingResult,
    });
  } catch (error) {
    logger?.error?.("calculatePricing error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to calculate subscription pricing",
    });
  }
}

/**
 * Generate Braintree client token (Candidate)
 * GET /api/candidate/subscriptions/client-token
 */
async function getClientToken(req, res) {
  try {
    if (!process.env.BRAINTREE_MERCHANT_ID) {
      return res.status(503).json({
        success: false,
        message: "Payment system is not configured. Please contact support.",
        error: "Braintree credentials missing",
      });
    }

    const candidateId = req.candidate.candidate_id;
    const email = req.candidate.email;
    const fullName = req.candidate.full_name || "";

    // Split full name into first and last names (best-effort)
    let firstName = fullName.trim();
    let lastName = "";
    if (firstName.includes(" ")) {
      const parts = firstName.split(/\s+/);
      firstName = parts.shift();
      lastName = parts.join(" ");
    }

    // Option A: Auto-provision Braintree customer if not exists
    try {
      const found = await braintreeService.findCustomer(candidateId);
      if (!found?.success || found?.notFound) {
        const created = await braintreeService.createCustomer({
          id: String(candidateId),
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          email: email || undefined,
        });

        if (!created?.success) {
          return res.status(502).json({
            success: false,
            message: "Failed to create payment customer",
            error: created?.message || "Unknown error",
            details: created?.errors,
          });
        }
      }
    } catch (e) {
      // If creation fails for some reason other than not-found, surface error
      return res.status(502).json({
        success: false,
        message: "Payment service error while preparing customer",
        error: e.message,
      });
    }

    // Now generate a client token bound to this customer. If that fails with not-found, fall back.
    let clientToken;
    try {
      clientToken = await braintreeService.generateClientToken(candidateId);
    } catch (e) {
      // Fallback: generate without customerId so frontend can still tokenize
      clientToken = await braintreeService.generateClientToken();
    }

    return res.status(200).json({
      success: true,
      message: "Client token generated successfully",
      data: {
        client_token: clientToken,
      },
    });
  } catch (error) {
    logger?.error?.("getClientToken error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to generate client token",
      error: error.message,
    });
  }
}

/**
 * Create subscription (Candidate)
 * POST /api/candidate/subscriptions
 */
async function createSubscription(req, res) {
  try {
    if (!process.env.BRAINTREE_MERCHANT_ID) {
      return res.status(503).json({
        success: false,
        message: "Payment system is not configured. Please contact support.",
        error: "Braintree credentials missing",
      });
    }

    const { plan_id, country_ids, payment_method_nonce } = req.body;
    const candidateId = req.candidate.candidate_id;

    if (
      !plan_id ||
      !country_ids ||
      !Array.isArray(country_ids) ||
      country_ids.length === 0 ||
      !payment_method_nonce
    ) {
      return res.status(400).json({
        success: false,
        message:
          "plan_id, country_ids array, and payment_method_nonce are required",
      });
    }

    const result = await createCandidateSubscription({
      candidateId,
      planId: plan_id,
      countryIds: country_ids,
      paymentMethodNonce: payment_method_nonce,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription created successfully",
      data: result,
    });
  } catch (error) {
    logger?.error?.("createSubscription error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to create subscription",
      details: error.details,
    });
  }
}

/**
 * Get candidate subscriptions (Candidate)
 * GET /api/candidate/subscriptions
 */
async function getMySubscriptions(req, res) {
  try {
    const candidateId = req.candidate.candidate_id;
    const { page, limit, status, sortBy, sortOrder } = req.query;

    const result = await getCandidateSubscriptions(candidateId, {
      page,
      limit,
      status,
      sortBy,
      sortOrder,
    });

    return res.status(200).json({
      success: true,
      message: "Subscriptions retrieved successfully",
      ...result,
    });
  } catch (error) {
    logger?.error?.("getMySubscriptions error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve subscriptions",
      error: error.message,
    });
  }
}

/**
 * Get subscription by ID (Candidate)
 * GET /api/candidate/subscriptions/:subscriptionId
 */
async function getSubscription(req, res) {
  try {
    const { subscriptionId } = req.params;
    const candidateId = req.candidate.candidate_id;

    const subscription = await getSubscriptionById(subscriptionId);

    // Ensure candidate can only view their own subscriptions
    if (subscription.candidate_id !== candidateId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own subscriptions.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription retrieved successfully",
      data: subscription,
    });
  } catch (error) {
    logger?.error?.("getSubscription error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve subscription",
    });
  }
}

/**
 * Cancel subscription (Candidate)
 * DELETE /api/candidate/subscriptions/:subscriptionId
 */
async function cancelMySubscription(req, res) {
  try {
    const { subscriptionId } = req.params;
    const candidateId = req.candidate.candidate_id;

    // First check if subscription belongs to candidate
    const subscription = await getSubscriptionById(subscriptionId);
    if (subscription.candidate_id !== candidateId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only cancel your own subscriptions.",
      });
    }

    const cancelledSubscription = await cancelSubscription(
      subscriptionId,
      candidateId
    );

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: cancelledSubscription,
    });
  } catch (error) {
    logger?.error?.("cancelMySubscription error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to cancel subscription",
    });
  }
}

// Admin Controllers for managing all subscriptions

/**
 * Get all subscriptions (Admin)
 * GET /api/admin/subscriptions
 */
async function getAllSubscriptions(req, res) {
  try {
    const { page, limit, status, candidate_id, plan_id, sortBy, sortOrder } =
      req.query;

    const whereClause = {};
    if (status) whereClause.status = status;
    if (candidate_id) whereClause.candidate_id = candidate_id;
    if (plan_id) whereClause.plan_id = plan_id;

    const PaginationService = require("../services/pagination.service");
    const {
      CandidateSubscription,
      SubscriptionPlan,
      SubscriptionCountry,
      Candidate,
      Country,
    } = require("../models");

    const result = await PaginationService.paginate({
      model: CandidateSubscription,
      page,
      limit,
      sortBy: sortBy || "created_at",
      sortOrder: sortOrder || "DESC",
      whereClause,
      include: [
        {
          model: Candidate,
          as: "candidate",
          attributes: ["candidate_id", "email", "full_name"],
        },
        {
          model: SubscriptionPlan,
          as: "plan",
          attributes: [
            "plan_id",
            "name",
            "description",
            "duration_days",
            "price_per_country",
          ],
        },
        {
          model: SubscriptionCountry,
          as: "countries",
          include: [
            {
              model: Country,
              as: "country",
              attributes: ["country_id", "country", "country_code"],
            },
          ],
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "All subscriptions retrieved successfully",
      ...result,
    });
  } catch (error) {
    logger?.error?.("getAllSubscriptions error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve subscriptions",
      error: error.message,
    });
  }
}

/**
 * Cancel any subscription (Admin)
 * DELETE /api/admin/subscriptions/:subscriptionId
 */
async function cancelAnySubscription(req, res) {
  try {
    const { subscriptionId } = req.params;

    // Get admin ID from the authenticated admin
    const adminId = req.admin?.user_id;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const cancelledSubscription = await cancelSubscription(
      subscriptionId,
      adminId
    );

    return res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: cancelledSubscription,
    });
  } catch (error) {
    logger?.error?.("cancelAnySubscription error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to cancel subscription",
    });
  }
}

/**
 * Get subscription plan by ID (Admin)
 * GET /api/admin/subscription-plans/:planId
 */
async function getPlan(req, res) {
  try {
    const { planId } = req.params;

    const plan = await getSubscriptionPlanById(planId);

    return res.status(200).json({
      success: true,
      message: "Subscription plan retrieved successfully",
      data: plan,
    });
  } catch (error) {
    logger?.error?.("getPlan error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve subscription plan",
    });
  }
}

/**
 * Delete subscription plan (Admin)
 * DELETE /api/admin/subscription-plans/:planId
 */
async function deletePlan(req, res) {
  try {
    const { planId } = req.params;

    // Get admin ID from the authenticated admin
    const adminId = req.admin?.user_id;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required",
      });
    }

    const plan = await deleteSubscriptionPlan(planId, adminId);

    return res.status(200).json({
      success: true,
      message: "Subscription plan deleted successfully",
      data: plan,
    });
  } catch (error) {
    logger?.error?.("deletePlan error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to delete subscription plan",
    });
  }
}

/**
 * Braintree webhook handler - Verification (GET)
 * GET /api/braintree/webhook
 */
async function verifyWebhook(req, res) {
  try {
    const challenge = req.query.bt_challenge;
    if (!challenge) {
      return res.status(400).send("Missing bt_challenge");
    }
    const verification = await braintreeService.verifyWebhookChallenge(challenge);
    return res.status(200).send(verification);
  } catch (error) {
    logger?.error?.("verifyWebhook error", { error: error.message });
    return res.status(500).send("Webhook verification failed");
  }
}

/**
 * Braintree webhook handler - Notification (POST)
 * POST /api/braintree/webhook
 */
async function handleWebhook(req, res) {
  try {
    const btSignature = req.body.bt_signature;
    const btPayload = req.body.bt_payload;
    if (!btSignature || !btPayload) {
      return res.status(400).send("Missing webhook body");
    }

    const notification = await braintreeService.parseWebhookNotification(
      btSignature,
      btPayload
    );

    // Handle subscription events
    const kind = notification.kind;
    const subscription = notification?.subscription;

    if (subscription?.id) {
      const { CandidateSubscription } = require("../models");
      const existing = await CandidateSubscription.findOne({
        where: { braintree_subscription_id: subscription.id },
      });

      if (existing) {
        let newStatus = existing.status;
        switch (kind) {
          case "subscription_charged_successfully":
            newStatus = "active";
            break;
          case "subscription_canceled":
            newStatus = "cancelled";
            break;
          case "subscription_expired":
            newStatus = "expired";
            break;
          case "subscription_charged_unsuccessfully":
            // keep status but mark payment failed
            await existing.update({ payment_status: "failed" });
            break;
          default:
            break;
        }
        if (newStatus !== existing.status) {
          await existing.update({ status: newStatus });
        }
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    logger?.error?.("handleWebhook error", { error: error.message });
    return res.status(500).send("Webhook processing failed");
  }
}

/**
 * Add countries to active subscription (Candidate)
 * POST /api/candidate/subscriptions/:subscriptionId/add-countries
 */
async function addCountries(req, res) {
  try {
    if (!process.env.BRAINTREE_MERCHANT_ID) {
      return res.status(503).json({
        success: false,
        message: "Payment system is not configured. Please contact support.",
        error: "Braintree credentials missing",
      });
    }

    const { subscriptionId } = req.params;
    const candidateId = req.candidate.candidate_id;

    // Validate request body
    const validation = validateAddCountriesToSubscription(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: getValidationErrorMessage(validation.errors),
      });
    }

    const { country_ids, payment_method_nonce } = validation.cleaned;

    const subscriptionService = require("../services/subscription.service");
    const result = await subscriptionService.addCountriesToSubscription({
      candidateId,
      subscriptionId,
      countryIds: country_ids,
      paymentMethodNonce: payment_method_nonce,
    });

    return res.status(200).json({
      success: true,
      message: "Countries added to subscription successfully",
      data: result,
    });
  } catch (error) {
    logger?.error?.("addCountries error", { error: error.message });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to add countries",
      details: error.details,
    });
  }
}

module.exports = {
  // Admin
  getAllPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  getAllSubscriptions,
  cancelAnySubscription,
  // Candidate
  getActivePlans,
  calculatePricing,
  getClientToken,
  createSubscription,
  getMySubscriptions,
  getSubscription,
  cancelMySubscription,
  // Webhooks
  verifyWebhook,
  handleWebhook,
  // Add countries
  addCountries,
};
