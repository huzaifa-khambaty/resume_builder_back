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
const braintreeService = require("./braintree.service");
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

    // Create plan in our database first
    const plan = await SubscriptionPlan.create({
      plan_id: uuidv4(),
      name: planData.name,
      description: planData.description,
      duration_days: planData.duration_days,
      price_per_country: planData.price_per_country,
      is_active: isActive,
      created_by: adminId,
    });

    // If Braintree is configured, create plan there too
    if (process.env.BRAINTREE_MERCHANT_ID) {
      try {
        const braintreePlanResult = await braintreeService.createPlan({
          id: plan.plan_id, // Use our plan UUID as Braintree plan ID
          name: planData.name,
          price: planData.price_per_country.toString(), // Convert to string for Braintree
        });

        if (!braintreePlanResult.success) {
          logger?.warn?.("Failed to create plan in Braintree", {
            planId: plan.plan_id,
            error: braintreePlanResult.message,
            errors: braintreePlanResult.errors,
          });
          // Continue anyway - plan is created in our database
        } else {
          logger?.info?.("Plan created successfully in Braintree", {
            planId: plan.plan_id,
            braintreePlanId: braintreePlanResult.plan.id,
          });
        }
      } catch (braintreeError) {
        logger?.warn?.("Braintree plan creation failed", {
          planId: plan.plan_id,
          error: braintreeError.message,
        });
        // Continue anyway - plan is created in our database
      }
    } else {
      logger?.info?.("Braintree not configured, plan created without Braintree plan", {
        planId: plan.plan_id,
      });
    }

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

    // If Braintree is configured and plan exists there, update it too
    if (process.env.BRAINTREE_MERCHANT_ID) {
      try {
        const braintreePlanResult = await braintreeService.findPlan(planId);

        if (braintreePlanResult.success) {
          // Plan exists in Braintree, update it
          const updateFields = {};
          if (updateData.name !== undefined)
            updateFields.name = updateData.name;
          if (updateData.price_per_country !== undefined) {
            updateFields.price = updateData.price_per_country.toString();
          }

          if (Object.keys(updateFields).length > 0) {
            const updateResult = await braintreeService.updatePlan(
              planId,
              updateFields
            );

            if (!updateResult.success) {
              logger?.warn?.("Failed to update plan in Braintree", {
                planId: plan.plan_id,
                error: updateResult.message,
                errors: updateResult.errors,
              });
            } else {
              logger?.info?.("Plan updated successfully in Braintree", {
                planId: plan.plan_id,
                braintreePlanId: updateResult.plan.id,
              });
            }
          }
        }
      } catch (braintreeError) {
        logger?.warn?.("Braintree plan update check failed", {
          planId: plan.plan_id,
          error: braintreeError.message,
        });
      }
    }

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
      // If there's an active subscription, new subscription duration is limited to remaining days
      effectiveDurationDays = Math.min(remainingDays, plan.duration_days);
      startDate = new Date();
      endDate = new Date();
      endDate.setDate(endDate.getDate() + effectiveDurationDays);

      // Calculate prorated amount based on effective duration
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
 * @param {string} subscriptionData.paymentMethodNonce - Braintree payment nonce
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

    // Create Braintree customer if not exists
    let braintreeCustomerId = candidateId;
    const customerResult = await braintreeService.findCustomer(
      braintreeCustomerId
    );

    if (customerResult.notFound) {
      const nameparts = candidate.full_name.split(" ");
      const firstName = nameparts[0] || "";
      const lastName = nameparts.slice(1).join(" ") || "";

      const createCustomerResult = await braintreeService.createCustomer({
        id: braintreeCustomerId,
        firstName,
        lastName,
        email: candidate.email,
      });

      if (!createCustomerResult.success) {
        const error = new Error(
          `Failed to create Braintree customer: ${createCustomerResult.message}`
        );
        error.status = 400;
        throw error;
      }
    }

    // Process payment
    const transactionResult = await braintreeService.processTransaction({
      amount: pricingResult.finalAmount.toString(),
      paymentMethodNonce,
      customerId: braintreeCustomerId,
      options: {
        submitForSettlement: true,
      },
    });

    if (!transactionResult.success) {
      const error = new Error(`Payment failed: ${transactionResult.message}`);
      error.status = 400;
      error.details = transactionResult.errors;
      throw error;
    }

    // Create subscription record
    const subscription = await CandidateSubscription.create({
      subscription_id: uuidv4(),
      candidate_id: candidateId,
      plan_id: planId,
      braintree_transaction_id: transactionResult.transaction.id,
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
          payment_gateway: "braintree",
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
      transaction: transactionResult.transaction,
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

    // Cancel in Braintree if subscription ID exists
    if (subscription.braintree_subscription_id) {
      const braintreeResult = await braintreeService.cancelSubscription(
        subscription.braintree_subscription_id
      );
      if (!braintreeResult.success) {
        logger?.warn?.("Failed to cancel Braintree subscription", {
          subscriptionId,
          braintreeSubscriptionId: subscription.braintree_subscription_id,
          error: braintreeResult.message,
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

    // Get candidate and ensure Braintree customer
    const candidate = await Candidate.findByPk(candidateId);
    if (!candidate) {
      const error = new Error("Candidate not found");
      error.status = 404;
      throw error;
    }

    let braintreeCustomerId = candidateId;
    const customerResult = await braintreeService.findCustomer(
      braintreeCustomerId
    );

    if (customerResult.notFound) {
      const nameparts = (candidate.full_name || "").split(" ");
      const firstName = nameparts[0] || "";
      const lastName = nameparts.slice(1).join(" ") || "";

      const createCustomerResult = await braintreeService.createCustomer({
        id: braintreeCustomerId,
        firstName,
        lastName,
        email: candidate.email,
      });

      if (!createCustomerResult.success) {
        const error = new Error(
          `Failed to create Braintree customer: ${createCustomerResult.message}`
        );
        error.status = 400;
        throw error;
      }
    }

    // Process payment if amount > 0
    let transactionResult = { success: true, transaction: null };
    if (finalAmount > 0) {
      transactionResult = await braintreeService.processTransaction({
        amount: finalAmount.toString(),
        paymentMethodNonce,
        customerId: braintreeCustomerId,
        options: { submitForSettlement: true },
      });

      if (!transactionResult.success) {
        const error = new Error(`Payment failed: ${transactionResult.message}`);
        error.status = 400;
        error.details = transactionResult.errors;
        throw error;
      }
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
      braintree_transaction_id:
        transactionResult.transaction?.id ||
        subscription.braintree_transaction_id,
      updated_by: candidateId,
    });

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
      transaction: transactionResult.transaction,
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

    // Check if removing all countries (must keep at least one)
    const remainingCountries = subscription.countries.filter(
      (c) => !toRemove.includes(c.country_id)
    );

    if (remainingCountries.length === 0) {
      const error = new Error(
        "Cannot remove all countries. At least one country must remain in the subscription."
      );
      error.status = 400;
      throw error;
    }

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
