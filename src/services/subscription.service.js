const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const {
  SubscriptionPlan,
  CandidateSubscription,
  SubscriptionCountry,
  Candidate,
  Country,
} = require("../models");
const PaginationService = require("./pagination.service");
const stripeService = require("./stripe.service");
const logger = require("../config/logger");

/**
 * Get all subscription plans for admin
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Paginated subscription plans
 */
async function getAllSubscriptionPlans(options = {}) {
  try {
    const result = await PaginationService.paginate({
      model: SubscriptionPlan,
      page: options.page,
      limit: options.limit,
      search: options.search,
      sortBy: options.sortBy || "price_per_country",
      sortOrder: options.sortOrder || "ASC",
      attributes: [
        "plan_id",
        "name",
        "description",
        "duration_days",
        "price_per_country",
        "is_active",
        "created_at",
        "updated_at",
      ],
      searchableFields: ["name", "description"],
      allowedSortFields: [
        "name",
        "duration_days",
        "price_per_country",
        "is_active",
        "created_at",
        "updated_at",
      ],
      whereClause:
        options.is_active !== undefined ? { is_active: options.is_active } : {},
    });

    return result;
  } catch (error) {
    logger?.error?.("getAllSubscriptionPlans error", { error: error.message });
    throw error;
  }
}

/**
 * Get active subscription plans for candidates
 * @returns {Promise<Array>} Active subscription plans
 */
async function getActiveSubscriptionPlans() {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { is_active: true },
      attributes: [
        "plan_id",
        "name",
        "description",
        "duration_days",
        "price_per_country",
      ],
      order: [["duration_days", "ASC"]],
    });

    return plans;
  } catch (error) {
    logger?.error?.("getActiveSubscriptionPlans error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create subscription plan (Admin only)
 * @param {Object} planData - Plan data
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Created plan
 */
async function createSubscriptionPlan(planData, adminId) {
  try {
    // Determine active flag and enforce single active plan
    const isActive =
      planData.is_active !== undefined ? !!planData.is_active : true;

    if (isActive) {
      // Deactivate all other active plans to enforce single active plan
      await SubscriptionPlan.update(
        { is_active: false },
        { where: { is_active: true } }
      );
    }

    // Create Stripe Price for this plan
    let stripePriceId = null;
    try {
      const stripePrice = await stripeService.createPriceForPlan({
        unitAmountCents: Math.round(
          parseFloat(planData.price_per_country) * 100
        ),
        currency: "usd",
        planName: planData.name,
        durationDays: planData.duration_days,
      });
      stripePriceId = stripePrice.id;
    } catch (stripeError) {
      logger?.warn?.("Failed to create Stripe price for plan", {
        error: stripeError.message,
        planName: planData.name,
      });
      // Continue without Stripe price - can be created later
    }

    // Create plan in our database
    const plan = await SubscriptionPlan.create({
      plan_id: uuidv4(),
      name: planData.name,
      description: planData.description,
      duration_days: planData.duration_days,
      price_per_country: planData.price_per_country,
      is_active: isActive,
      stripe_price_id: stripePriceId,
      created_by: adminId,
    });

    return plan;
  } catch (error) {
    logger?.error?.("createSubscriptionPlan error", { error: error.message });
    throw error;
  }
}

/**
 * Update subscription plan (Admin only)
 * @param {string} planId - Plan ID
 * @param {Object} updateData - Update data
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Updated plan
 */
async function updateSubscriptionPlan(planId, updateData, adminId) {
  try {
    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan) {
      const error = new Error("Subscription plan not found");
      error.status = 404;
      throw error;
    }

    // Check for name uniqueness if name is being updated
    if (updateData.name && updateData.name !== plan.name) {
      const existingPlan = await SubscriptionPlan.findOne({
        where: {
          name: updateData.name,
          plan_id: { [Op.ne]: planId }, // Exclude current plan
        },
      });

      if (existingPlan) {
        const error = new Error(
          `A subscription plan with the name '${updateData.name}' already exists`
        );
        error.status = 409;
        error.name = "SequelizeUniqueConstraintError";
        error.errors = [{ path: "name", value: updateData.name }];
        throw error;
      }
    }

    await plan.update({
      ...updateData,
      updated_by: adminId,
    });

    // External plan sync removed (Braintree deprecated)

    return plan;
  } catch (error) {
    logger?.error?.("updateSubscriptionPlan error", { error: error.message });
    throw error;
  }
}

/**
 * Calculate remaining days for a candidate's active subscriptions
 * @param {string} candidateId - Candidate ID
 * @returns {Promise<number>} Remaining days (0 if no active subscription)
 */
async function calculateRemainingDays(candidateId) {
  try {
    const activeSubscription = await CandidateSubscription.findOne({
      where: {
        candidate_id: candidateId,
        status: "active",
        end_date: {
          [Op.gt]: new Date(),
        },
      },
      order: [["end_date", "DESC"]],
    });

    if (!activeSubscription) {
      return 0;
    }

    const now = new Date();
    const endDate = new Date(activeSubscription.end_date);
    const diffTime = endDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  } catch (error) {
    logger?.error?.("calculateRemainingDays error", { error: error.message });
    throw error;
  }
}

/**
 * Calculate subscription pricing and dates
 * @param {string} planId - Subscription plan ID
 * @param {Array} countryIds - Array of country IDs
 * @param {string} candidateId - Candidate ID
 * @returns {Promise<Object>} Calculation result
 */
async function calculateSubscriptionPricing(planId, countryIds, candidateId) {
  try {
    // Get plan details
    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan || !plan.is_active) {
      const error = new Error("Subscription plan not found or inactive");
      error.status = 404;
      throw error;
    }

    // Validate countries
    const countries = await Country.findAll({
      where: {
        country_id: {
          [Op.in]: countryIds,
        },
      },
    });

    if (countries.length !== countryIds.length) {
      const error = new Error("One or more invalid country IDs");
      error.status = 400;
      throw error;
    }

    const countryCount = countryIds.length;
    const totalAmount = parseFloat(plan.price_per_country) * countryCount;

    // Calculate start and end dates based on remaining subscription time
    const remainingDays = await calculateRemainingDays(candidateId);

    let startDate;
    let endDate;
    let effectiveDurationDays;

    if (remainingDays > 0) {
      // If there's an active subscription, anchor to its actual end_date to avoid rounding drift
      const activeSubscription = await CandidateSubscription.findOne({
        where: {
          candidate_id: candidateId,
          status: "active",
          end_date: { [Op.gt]: new Date() },
        },
        order: [["end_date", "DESC"]],
      });

      const now = new Date();
      const activeEnd = activeSubscription
        ? new Date(activeSubscription.end_date)
        : null;

      if (
        activeSubscription &&
        activeEnd instanceof Date &&
        !isNaN(activeEnd)
      ) {
        const msDiff = activeEnd.getTime() - now.getTime();
        const preciseRemainingDays = Math.max(
          0,
          Math.ceil(msDiff / (1000 * 60 * 60 * 24))
        );

        // New charge is prorated for the shorter of remaining days and plan duration
        effectiveDurationDays = Math.min(
          preciseRemainingDays,
          plan.duration_days
        );
        startDate = now;
        // Critically: set endDate to the ACTIVE subscription's actual end_date
        endDate = activeEnd;

        const prorationFactor = effectiveDurationDays / plan.duration_days;
        const proratedAmount = totalAmount * prorationFactor;

        return {
          plan,
          countries,
          countryCount,
          originalAmount: totalAmount,
          finalAmount: parseFloat(proratedAmount.toFixed(2)),
          effectiveDurationDays,
          originalDurationDays: plan.duration_days,
          remainingDays: preciseRemainingDays,
          isProrated: true,
          startDate,
          endDate,
        };
      } else {
        // Fallback to previous behavior if for some reason the active sub couldn't be fetched
        effectiveDurationDays = Math.min(remainingDays, plan.duration_days);
        startDate = new Date();
        endDate = new Date();
        endDate.setDate(endDate.getDate() + effectiveDurationDays);

        const prorationFactor = effectiveDurationDays / plan.duration_days;
        const proratedAmount = totalAmount * prorationFactor;

        return {
          plan,
          countries,
          countryCount,
          originalAmount: totalAmount,
          finalAmount: parseFloat(proratedAmount.toFixed(2)),
          effectiveDurationDays,
          originalDurationDays: plan.duration_days,
          remainingDays,
          isProrated: true,
          startDate,
          endDate,
        };
      }
    } else {
      // No active subscription, use full plan duration
      effectiveDurationDays = plan.duration_days;
      startDate = new Date();
      endDate = new Date();
      endDate.setDate(endDate.getDate() + effectiveDurationDays);

      return {
        plan,
        countries,
        countryCount,
        originalAmount: totalAmount,
        finalAmount: totalAmount,
        effectiveDurationDays,
        originalDurationDays: plan.duration_days,
        remainingDays: 0,
        isProrated: false,
        startDate,
        endDate,
      };
    }
  } catch (error) {
    logger?.error?.("calculateSubscriptionPricing error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create candidate subscription
 * @param {Object} subscriptionData
 * @param {string} subscriptionData.candidateId - Candidate ID
 * @param {string} subscriptionData.planId - Plan ID
 * @param {Array} subscriptionData.countryIds - Country IDs
 * @param {string} subscriptionData.paymentMethodNonce - Payment method identifier
 * @returns {Promise<Object>} Created subscription
 */
async function createCandidateSubscription(subscriptionData) {
  const { candidateId, planId, countryIds, paymentMethodNonce } =
    subscriptionData;

  try {
    // Calculate pricing
    const pricingResult = await calculateSubscriptionPricing(
      planId,
      countryIds,
      candidateId
    );

    // Get candidate details
    const candidate = await Candidate.findByPk(candidateId);
    if (!candidate) {
      const error = new Error("Candidate not found");
      error.status = 404;
      throw error;
    }

    // Stripe: ensure customer, attach payment method, charge prorated amount
    const stripeCustomer = await stripeService.getOrCreateCustomer({
      candidateId,
      email: candidate.email,
      name: candidate.full_name,
    });

    if (!paymentMethodNonce) {
      const error = new Error("Payment method is required");
      error.status = 400;
      throw error;
    }

    await stripeService.attachPaymentMethod({
      customerId: stripeCustomer.id,
      paymentMethodId: paymentMethodNonce,
    });

    const amountCents = Math.round(parseFloat(pricingResult.finalAmount) * 100);
    const paymentIntent = await stripeService.createAndConfirmPaymentIntent({
      amountCents,
      currency: "usd",
      customerId: stripeCustomer.id,
      paymentMethodId: paymentMethodNonce,
      description: `Subscription initial charge for candidate ${candidateId}`,
      metadata: { candidate_id: candidateId, plan_id: planId },
    });

    // Use existing Stripe Price ID from plan, or create one if missing
    let priceId = pricingResult?.plan?.stripe_price_id;

    if (!priceId) {
      // Fallback: create price if not exists (for old plans)
      const perCycleCents = Math.round(
        parseFloat(pricingResult?.plan?.price_per_country || 0) * 100
      );
      const price = await stripeService.createPriceForPlan({
        unitAmountCents: perCycleCents,
        currency: "usd",
        planName: pricingResult?.plan?.name,
        durationDays: pricingResult?.plan?.duration_days,
      });
      priceId = price.id;

      // Update plan with the new Stripe Price ID
      await SubscriptionPlan.update(
        { stripe_price_id: priceId },
        { where: { plan_id: planId } }
      );
    }

    const stripeSub = await stripeService.createSubscriptionAnchored({
      customerId: stripeCustomer.id,
      priceId: priceId,
      anchorDate: pricingResult.endDate,
      prorationBehavior: "none",
      metadata: { candidate_id: candidateId, plan_id: planId },
    });

    // Create subscription record
    const subscription = await CandidateSubscription.create({
      subscription_id: uuidv4(),
      candidate_id: candidateId,
      plan_id: planId,
      stripe_customer_id: stripeCustomer.id,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_subscription_id: stripeSub.id,
      stripe_price_id: priceId,
      country_count: pricingResult.countryCount,
      total_amount: pricingResult.finalAmount,
      start_date: pricingResult.startDate,
      end_date: pricingResult.endDate,
      status: "active",
      payment_status: "completed",
      created_by: candidateId,
    });

    // Create subscription countries
    const subscriptionCountries = countryIds.map((countryId) => ({
      id: uuidv4(),
      subscription_id: subscription.subscription_id,
      country_id: countryId,
    }));

    await SubscriptionCountry.bulkCreate(subscriptionCountries);

    // Persist summary to Candidate table (denormalized columns)
    try {
      await Candidate.update(
        {
          payment_gateway: "stripe",
          subscription_id: subscription.subscription_id,
          qty: pricingResult.countryCount,
          unit_price: pricingResult?.plan?.price_per_country ?? null,
          expiry_date: pricingResult.endDate,
          updated_by: candidateId,
        },
        { where: { candidate_id: candidateId } }
      );
    } catch (persistErr) {
      logger?.warn?.("Failed to persist subscription summary to Candidate", {
        candidateId,
        error: persistErr.message,
      });
      // do not block flow
    }

    // Return complete subscription data
    const completeSubscription = await CandidateSubscription.findByPk(
      subscription.subscription_id,
      {
        include: [
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
      }
    );

    return {
      subscription: completeSubscription,
      transaction: paymentIntent,
      pricingDetails: pricingResult,
    };
  } catch (error) {
    logger?.error?.("createCandidateSubscription error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get candidate subscriptions
 * @param {string} candidateId - Candidate ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Candidate subscriptions
 */
async function getCandidateSubscriptions(candidateId, options = {}) {
  try {
    const whereClause = { candidate_id: candidateId };

    if (options.status) {
      whereClause.status = options.status;
    }

    const result = await PaginationService.paginate({
      model: CandidateSubscription,
      page: options.page,
      limit: options.limit,
      sortBy: options.sortBy || "created_at",
      sortOrder: options.sortOrder || "DESC",
      whereClause,
      include: [
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

    return result;
  } catch (error) {
    logger?.error?.("getCandidateSubscriptions error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get subscription by ID
 * @param {string} subscriptionId - Subscription ID
 * @returns {Promise<Object>} Subscription details
 */
async function getSubscriptionById(subscriptionId) {
  try {
    const subscription = await CandidateSubscription.findByPk(subscriptionId, {
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

    if (!subscription) {
      const error = new Error("Subscription not found");
      error.status = 404;
      throw error;
    }

    return subscription;
  } catch (error) {
    logger?.error?.("getSubscriptionById error", { error: error.message });
    throw error;
  }
}

/**
 * Cancel subscription
 * @param {string} subscriptionId - Subscription ID
 * @param {string} userId - User ID (candidate or admin)
 * @returns {Promise<Object>} Updated subscription
 */
async function cancelSubscription(subscriptionId, userId) {
  try {
    const subscription = await CandidateSubscription.findByPk(subscriptionId);

    if (!subscription) {
      const error = new Error("Subscription not found");
      error.status = 404;
      throw error;
    }

    if (subscription.status === "cancelled") {
      const error = new Error("Subscription is already cancelled");
      error.status = 400;
      throw error;
    }

    // Cancel in Stripe if subscription ID exists
    if (subscription.stripe_subscription_id) {
      try {
        await stripeService.cancelSubscription(
          subscription.stripe_subscription_id
        );
      } catch (e) {
        logger?.warn?.("Failed to cancel Stripe subscription", {
          subscriptionId,
          stripeSubscriptionId: subscription.stripe_subscription_id,
          error: e.message,
        });
      }
    }

    // Update subscription status
    await subscription.update({
      status: "cancelled",
      updated_by: userId,
    });

    return subscription;
  } catch (error) {
    logger?.error?.("cancelSubscription error", { error: error.message });
    throw error;
  }
}

/**
 * Soft delete subscription plan (Admin only)
 * @param {string} planId - Plan ID
 * @param {string} adminId - Admin user ID
 * @returns {Promise<Object>} Updated plan
 */
async function deleteSubscriptionPlan(planId, adminId) {
  try {
    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan) {
      const error = new Error("Subscription plan not found");
      error.status = 404;
      throw error;
    }

    // Check if plan has active subscriptions
    const activeSubscriptions = await CandidateSubscription.count({
      where: {
        plan_id: planId,
        status: "active",
        end_date: {
          [Op.gt]: new Date(),
        },
      },
    });

    if (activeSubscriptions > 0) {
      const error = new Error(
        `Cannot delete plan. ${activeSubscriptions} active subscription(s) exist. Deactivate instead.`
      );
      error.status = 409;
      throw error;
    }

    // Soft delete by setting is_active to false
    await plan.update({
      is_active: false,
      updated_by: adminId,
    });

    logger?.info?.("Subscription plan soft deleted", {
      planId: plan.plan_id,
      adminId,
    });

    return plan;
  } catch (error) {
    logger?.error?.("deleteSubscriptionPlan error", { error: error.message });
    throw error;
  }
}

/**
 * Get subscription plan by ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Subscription plan details
 */
async function getSubscriptionPlanById(planId) {
  try {
    const plan = await SubscriptionPlan.findByPk(planId, {
      attributes: [
        "plan_id",
        "name",
        "description",
        "duration_days",
        "price_per_country",
        "is_active",
        "created_at",
        "updated_at",
      ],
    });

    if (!plan) {
      const error = new Error("Subscription plan not found");
      error.status = 404;
      throw error;
    }

    return plan;
  } catch (error) {
    logger?.error?.("getSubscriptionPlanById error", { error: error.message });
    throw error;
  }
}

/**
 * Add countries to an existing active subscription (Candidate)
 * @param {Object} data
 * @param {string} data.candidateId
 * @param {string} data.subscriptionId
 * @param {Array<string>} data.countryIds
 * @param {string} data.paymentMethodNonce
 * @returns {Promise<Object>}
 */
async function addCountriesToSubscription({
  candidateId,
  subscriptionId,
  countryIds,
  paymentMethodNonce,
}) {
  try {
    // Validate subscription
    const subscription = await CandidateSubscription.findByPk(subscriptionId, {
      include: [
        { model: SubscriptionPlan, as: "plan" },
        { model: SubscriptionCountry, as: "countries" },
      ],
    });

    if (!subscription) {
      const error = new Error("Subscription not found");
      error.status = 404;
      throw error;
    }

    if (subscription.candidate_id !== candidateId) {
      const error = new Error(
        "Forbidden: Subscription does not belong to candidate"
      );
      error.status = 403;
      throw error;
    }

    if (subscription.status !== "active") {
      const error = new Error("Only active subscriptions can be modified");
      error.status = 400;
      throw error;
    }

    // Determine remaining days on this subscription
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    if (!(endDate instanceof Date) || isNaN(endDate)) {
      const error = new Error("Subscription end date is invalid");
      error.status = 400;
      throw error;
    }

    const msRemaining = endDate.getTime() - now.getTime();
    if (msRemaining <= 0) {
      const error = new Error("Subscription has already expired");
      error.status = 400;
      throw error;
    }

    const remainingDays = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    // Get plan details
    const plan = await SubscriptionPlan.findByPk(subscription.plan_id);
    if (!plan || !plan.is_active) {
      const error = new Error("Subscription plan not found or inactive");
      error.status = 404;
      throw error;
    }

    // Filter out existing countries
    const existingCountryIds = new Set(
      (subscription.countries || []).map((c) => c.country_id)
    );
    const toAdd = (countryIds || []).filter(
      (id) => id && !existingCountryIds.has(id)
    );

    if (!toAdd.length) {
      const error = new Error("No new countries to add");
      error.status = 400;
      throw error;
    }

    // Validate new countries exist
    const countries = await Country.findAll({
      where: { country_id: { [Op.in]: toAdd } },
    });
    if (countries.length !== toAdd.length) {
      const error = new Error("One or more invalid country IDs");
      error.status = 400;
      throw error;
    }

    // Prorated pricing based on remaining days
    const originalAmount = parseFloat(plan.price_per_country) * toAdd.length;
    const effectiveDurationDays = Math.min(remainingDays, plan.duration_days);
    const prorationFactor = effectiveDurationDays / plan.duration_days;
    const finalAmount = parseFloat(
      (originalAmount * prorationFactor).toFixed(2)
    );

    // Get candidate and ensure Stripe customer
    const candidate = await Candidate.findByPk(candidateId);
    if (!candidate) {
      const error = new Error("Candidate not found");
      error.status = 404;
      throw error;
    }

    // Stripe: attach payment method (if provided) and charge prorated amount
    let paymentIntent = null;
    const stripeCustomer = await stripeService.getOrCreateCustomer({
      candidateId,
      email: candidate.email,
      name: candidate.full_name,
    });
    if (finalAmount > 0) {
      if (!paymentMethodNonce) {
        const error = new Error(
          "Payment method is required for additional charge"
        );
        error.status = 400;
        throw error;
      }
      await stripeService.attachPaymentMethod({
        customerId: stripeCustomer.id,
        paymentMethodId: paymentMethodNonce,
      });
      const amountCents = Math.round(finalAmount * 100);
      paymentIntent = await stripeService.createAndConfirmPaymentIntent({
        amountCents,
        currency: "usd",
        customerId: stripeCustomer.id,
        paymentMethodId: paymentMethodNonce,
        description: `Prorated charge for adding countries to ${subscription.subscription_id}`,
        metadata: {
          candidate_id: candidateId,
          subscription_id: subscription.subscription_id,
        },
      });
    }

    // Create subscription countries
    const newSubscriptionCountries = toAdd.map((countryId) => ({
      id: uuidv4(),
      subscription_id: subscription.subscription_id,
      country_id: countryId,
    }));

    await SubscriptionCountry.bulkCreate(newSubscriptionCountries);

    // Update subscription summary
    const updatedCountryCount = subscription.country_count + toAdd.length;
    const updatedTotalAmount = parseFloat(
      (parseFloat(subscription.total_amount) + finalAmount).toFixed(2)
    );

    await subscription.update({
      country_count: updatedCountryCount,
      total_amount: updatedTotalAmount,
      stripe_payment_intent_id:
        paymentIntent?.id || subscription.stripe_payment_intent_id,
      updated_by: candidateId,
    });

    // Ensure Stripe subscription reflects new per-cycle price for next cycle
    try {
      const perCycleCents = Math.round(
        parseFloat(plan.price_per_country) * updatedCountryCount * 100
      );

      if (subscription.stripe_subscription_id) {
        const price = await stripeService.createPriceForPlan({
          unitAmountCents: perCycleCents,
          currency: "usd",
          planName: plan.name,
          durationDays: plan.duration_days,
        });
        await stripeService.updateSubscriptionPrice({
          subscriptionId: subscription.stripe_subscription_id,
          newPriceId: price.id,
          prorationBehavior: "none",
        });
        await subscription.update({ stripe_price_id: price.id });
      }
    } catch (err) {
      logger?.warn?.("Auto-renewal price update failed (Stripe)", {
        error: err.message,
      });
    }

    // Reload with associations
    const completeSubscription = await CandidateSubscription.findByPk(
      subscription.subscription_id,
      {
        include: [
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
      }
    );

    return {
      subscription: completeSubscription,
      transaction: paymentIntent,
      pricingDetails: {
        plan,
        countries,
        addedCountryCount: toAdd.length,
        addedOriginalAmount: originalAmount,
        addedFinalAmount: finalAmount,
        effectiveDurationDays,
        originalDurationDays: plan.duration_days,
        remainingDays,
        isProrated: effectiveDurationDays < plan.duration_days,
        startDate: new Date().toISOString(),
        endDate: subscription.end_date,
      },
    };
  } catch (error) {
    logger?.error?.("addCountriesToSubscription error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Remove countries from an active subscription
 * @param {Object} params - Parameters
 * @param {string} params.candidateId - Candidate ID
 * @param {string} params.subscriptionId - Subscription ID
 * @param {string[]} params.countryIds - Array of country IDs to remove
 * @returns {Object} Updated subscription data
 */
async function removeCountriesFromSubscription({
  candidateId,
  subscriptionId,
  countryIds,
}) {
  try {
    // Get subscription with countries
    const subscription = await CandidateSubscription.findByPk(subscriptionId, {
      include: [
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
        {
          model: SubscriptionPlan,
          as: "plan",
          attributes: ["plan_id", "name", "price_per_country"],
        },
      ],
    });

    if (!subscription) {
      const error = new Error("Subscription not found");
      error.status = 404;
      throw error;
    }

    if (subscription.candidate_id !== candidateId) {
      const error = new Error(
        "Forbidden: Subscription does not belong to candidate"
      );
      error.status = 403;
      throw error;
    }

    if (subscription.status !== "active") {
      const error = new Error("Only active subscriptions can be modified");
      error.status = 400;
      throw error;
    }

    // Check if subscription has expired
    const now = new Date();
    const endDate = new Date(subscription.end_date);
    if (endDate <= now) {
      const error = new Error("Subscription has already expired");
      error.status = 400;
      throw error;
    }

    // Get existing country IDs in subscription
    const existingCountryIds = new Set(
      (subscription.countries || []).map((c) => c.country_id)
    );

    // Filter to only remove countries that actually exist in the subscription
    const toRemove = (countryIds || []).filter(
      (id) => id && existingCountryIds.has(id)
    );

    if (!toRemove.length) {
      const error = new Error("No valid countries to remove from subscription");
      error.status = 400;
      throw error;
    }

    // Determine remaining countries after removal (allow zero)
    const remainingCountries = subscription.countries.filter(
      (c) => !toRemove.includes(c.country_id)
    );

    // Validate countries to remove exist
    const countries = await Country.findAll({
      where: { country_id: { [Op.in]: toRemove } },
    });
    if (countries.length !== toRemove.length) {
      const error = new Error("One or more invalid country IDs");
      error.status = 400;
      throw error;
    }

    // Remove countries from subscription
    await SubscriptionCountry.destroy({
      where: {
        subscription_id: subscriptionId,
        country_id: { [Op.in]: toRemove },
      },
    });

    // Update subscription metadata
    const newCountryCount = remainingCountries.length;
    await CandidateSubscription.update(
      {
        country_count: newCountryCount,
        updated_by: candidateId,
      },
      { where: { subscription_id: subscriptionId } }
    );

    // Update recurring price in Stripe if subscription exists
    try {
      if (subscription.stripe_subscription_id) {
        const perCycleCents = Math.round(
          parseFloat(subscription.plan.price_per_country) *
            newCountryCount *
            100
        );
        const price = await stripeService.createPriceForPlan({
          unitAmountCents: perCycleCents,
          currency: "usd",
          planName: subscription.plan.name,
          durationDays: subscription.plan.duration_days,
        });
        await stripeService.updateSubscriptionPrice({
          subscriptionId: subscription.stripe_subscription_id,
          newPriceId: price.id,
          prorationBehavior: "none",
        });
        await CandidateSubscription.update(
          { stripe_price_id: price.id },
          { where: { subscription_id: subscriptionId } }
        );
      }
    } catch (err) {
      logger?.warn?.("Auto-renewal price update (remove, Stripe) failed", {
        error: err.message,
      });
    }

    // Update candidate summary (denormalized columns)
    try {
      await Candidate.update(
        {
          qty: newCountryCount,
          updated_by: candidateId,
        },
        { where: { candidate_id: candidateId } }
      );
    } catch (persistErr) {
      logger?.warn?.("Failed to persist subscription summary to Candidate", {
        candidateId,
        error: persistErr.message,
      });
      // do not block flow
    }

    // Return complete subscription data
    const completeSubscription = await CandidateSubscription.findByPk(
      subscriptionId,
      {
        include: [
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
      }
    );

    return {
      subscription: completeSubscription,
      removedCountries: countries,
      removedCountryCount: toRemove.length,
      remainingCountryCount: newCountryCount,
    };
  } catch (error) {
    logger?.error?.("removeCountriesFromSubscription error", {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
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
  calculateRemainingDays,
  addCountriesToSubscription,
  removeCountriesFromSubscription,
};

/**
 * Get the currently active subscription for a candidate (if any)
 * Includes plan and countries
 * @param {string} candidateId
 * @returns {Promise<CandidateSubscription|null>}
 */
async function getActiveSubscriptionForCandidate(candidateId) {
  try {
    const active = await CandidateSubscription.findOne({
      where: {
        candidate_id: candidateId,
        status: "active",
        end_date: { [Op.gt]: new Date() },
      },
      include: [
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
      order: [["end_date", "DESC"]],
    });

    return active;
  } catch (error) {
    logger?.error?.("getActiveSubscriptionForCandidate error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get list of countries currently in a subscription
 * @param {string} subscriptionId
 * @returns {Promise<Array<Country>>}
 */
async function getSubscriptionCountries(subscriptionId) {
  try {
    const rows = await SubscriptionCountry.findAll({
      where: { subscription_id: subscriptionId },
      include: [
        {
          model: Country,
          as: "country",
          attributes: ["country_id", "country", "country_code"],
        },
      ],
    });

    return rows.map((r) => r.country).filter(Boolean);
  } catch (error) {
    logger?.error?.("getSubscriptionCountries error", { error: error.message });
    throw error;
  }
}

/**
 * Get list of countries NOT yet in a subscription (available to add)
 * @param {string} subscriptionId
 * @returns {Promise<Array<Country>>}
 */
async function getAvailableCountriesForSubscription(subscriptionId) {
  try {
    const rows = await SubscriptionCountry.findAll({
      where: { subscription_id: subscriptionId },
      attributes: ["country_id"],
    });
    const existingIds = rows.map((r) => r.country_id);

    const whereClause = existingIds.length
      ? { country_id: { [Op.notIn]: existingIds } }
      : {};

    const available = await Country.findAll({
      where: whereClause,
      attributes: ["country_id", "country", "country_code"],
      order: [["country", "ASC"]],
    });

    return available;
  } catch (error) {
    logger?.error?.("getAvailableCountriesForSubscription error", {
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
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
  calculateRemainingDays,
  addCountriesToSubscription,
  removeCountriesFromSubscription,
  getActiveSubscriptionForCandidate,
  getSubscriptionCountries,
  getAvailableCountriesForSubscription,
};
