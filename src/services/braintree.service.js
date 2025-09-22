const braintree = require("braintree");
const logger = require("../config/logger");

// Check if Braintree credentials are available
if (
  !process.env.BRAINTREE_MERCHANT_ID ||
  !process.env.BRAINTREE_PUBLIC_KEY ||
  !process.env.BRAINTREE_PRIVATE_KEY
) {
  console.warn(
    "⚠️  Braintree credentials are missing. Please add them to your .env file:"
  );
  console.warn("   BRAINTREE_ENVIRONMENT=Sandbox");
  console.warn("   BRAINTREE_MERCHANT_ID=your_merchant_id");
  console.warn("   BRAINTREE_PUBLIC_KEY=your_public_key");
  console.warn("   BRAINTREE_PRIVATE_KEY=your_private_key");
  console.warn(
    "\n   Subscription system will not work without these credentials."
  );
  console.warn(
    "   You can get sandbox credentials from: https://developer.paypal.com/braintree/docs/start/hello-sandbox\n"
  );
}

// Braintree configuration
const gateway = process.env.BRAINTREE_MERCHANT_ID
  ? new braintree.BraintreeGateway({
      environment:
        process.env.BRAINTREE_ENVIRONMENT === "Production"
          ? braintree.Environment.Production
          : braintree.Environment.Sandbox,
      merchantId: process.env.BRAINTREE_MERCHANT_ID,
      publicKey: process.env.BRAINTREE_PUBLIC_KEY,
      privateKey: process.env.BRAINTREE_PRIVATE_KEY,
    })
  : null;

/**
 * Generate client token for frontend
 * @param {string} customerId - Optional customer ID
 * @returns {Promise<string>} Client token
 */
async function generateClientToken(customerId = null) {
  try {
    if (!gateway) {
      throw new Error(
        "Braintree gateway not configured. Please check your environment variables."
      );
    }

    const options = {};
    if (customerId) {
      options.customerId = customerId;
    }

    const response = await gateway.clientToken.generate(options);

    if (response.success) {
      return response.clientToken;
    } else {
      throw new Error(`Failed to generate client token: ${response.message}`);
    }
  } catch (error) {
    logger?.error?.("Braintree generateClientToken error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create Braintree customer
 * @param {Object} customerData
 * @param {string} customerData.id - Customer ID
 * @param {string} customerData.firstName - Customer first name
 * @param {string} customerData.lastName - Customer last name
 * @param {string} customerData.email - Customer email
 * @returns {Promise<Object>} Customer creation result
 */
async function createCustomer(customerData) {
  try {
    const response = await gateway.customer.create({
      id: customerData.id,
      firstName: customerData.firstName,
      lastName: customerData.lastName,
      email: customerData.email,
    });

    if (response.success) {
      return {
        success: true,
        customer: response.customer,
      };
    } else {
      return {
        success: false,
        message: response.message,
        errors: response.errors,
      };
    }
  } catch (error) {
    logger?.error?.("Braintree createCustomer error", { error: error.message });
    throw error;
  }
}

/**
 * Find Braintree customer by ID
 * @param {string} customerId
 * @returns {Promise<Object>} Customer find result
 */
async function findCustomer(customerId) {
  try {
    const response = await gateway.customer.find(customerId);
    return {
      success: true,
      customer: response,
    };
  } catch (error) {
    if (error.type === "notFoundError") {
      return {
        success: false,
        notFound: true,
      };
    }
    logger?.error?.("Braintree findCustomer error", { error: error.message });
    throw error;
  }
}

/**
 * Process one-time payment transaction
 * @param {Object} transactionData
 * @param {string} transactionData.amount - Payment amount
 * @param {string} transactionData.paymentMethodNonce - Payment method nonce from frontend
 * @param {string} transactionData.customerId - Customer ID
 * @param {Object} transactionData.options - Additional options
 * @returns {Promise<Object>} Transaction result
 */
async function processTransaction(transactionData) {
  try {
    const transactionOptions = {
      amount: transactionData.amount,
      paymentMethodNonce: transactionData.paymentMethodNonce,
      options: {
        submitForSettlement: true,
        ...transactionData.options,
      },
    };

    if (transactionData.customerId) {
      transactionOptions.customerId = transactionData.customerId;
    }

    const response = await gateway.transaction.sale(transactionOptions);

    if (response.success) {
      return {
        success: true,
        transaction: response.transaction,
      };
    } else {
      // Enhanced error handling for common payment issues
      let errorMessage = response.message;
      
      // Check for nonce reuse error specifically
      if (response.errors && response.errors.deepErrors) {
        const nonceError = response.errors.deepErrors.find(error => 
          error.code === "91564" || 
          error.message?.includes("Cannot use a payment_method_nonce more than once")
        );
        
        if (nonceError) {
          errorMessage = "Payment method has already been used. Please refresh the page and try again.";
        }
      }
      
      // Check for validation errors on payment method nonce
      if (response.errors && response.errors.validationErrors && 
          response.errors.validationErrors.transaction && 
          response.errors.validationErrors.transaction.paymentMethodNonce) {
        const nonceValidationError = response.errors.validationErrors.transaction.paymentMethodNonce.find(error =>
          error.code === "91564" || 
          error.message?.includes("Cannot use a payment_method_nonce more than once")
        );
        
        if (nonceValidationError) {
          errorMessage = "Payment method has already been used. Please refresh the page and try again.";
        }
      }
      
      return {
        success: false,
        message: errorMessage,
        errors: response.errors,
        transaction: response.transaction,
      };
    }
  } catch (error) {
    logger?.error?.("Braintree processTransaction error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create subscription in Braintree
 * @param {Object} subscriptionData
 * @param {string} subscriptionData.paymentMethodToken - Payment method token
 * @param {string} subscriptionData.planId - Plan ID in Braintree
 * @param {string} subscriptionData.price - Subscription price
 * @returns {Promise<Object>} Subscription result
 */
async function createSubscription(subscriptionData) {
  try {
    const response = await gateway.subscription.create({
      paymentMethodToken: subscriptionData.paymentMethodToken,
      planId: subscriptionData.planId,
      price: subscriptionData.price,
    });

    if (response.success) {
      return {
        success: true,
        subscription: response.subscription,
      };
    } else {
      return {
        success: false,
        message: response.message,
        errors: response.errors,
      };
    }
  } catch (error) {
    logger?.error?.("Braintree createSubscription error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Cancel subscription in Braintree
 * @param {string} subscriptionId
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelSubscription(subscriptionId) {
  try {
    const response = await gateway.subscription.cancel(subscriptionId);

    if (response.success) {
      return {
        success: true,
        subscription: response.subscription,
      };
    } else {
      return {
        success: false,
        message: response.message,
        errors: response.errors,
      };
    }
  } catch (error) {
    logger?.error?.("Braintree cancelSubscription error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Find subscription in Braintree
 * @param {string} subscriptionId
 * @returns {Promise<Object>} Subscription find result
 */
async function findSubscription(subscriptionId) {
  try {
    const response = await gateway.subscription.find(subscriptionId);
    return {
      success: true,
      subscription: response,
    };
  } catch (error) {
    if (error.type === "notFoundError") {
      return {
        success: false,
        notFound: true,
      };
    }
    logger?.error?.("Braintree findSubscription error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Verify Braintree webhook challenge
 * @param {string} challenge
 * @returns {Promise<string>} verification string
 */
async function verifyWebhookChallenge(challenge) {
  try {
    if (!gateway) {
      throw new Error(
        "Braintree gateway not configured. Please check your environment variables."
      );
    }
    return gateway.webhookNotification.verify(challenge);
  } catch (error) {
    logger?.error?.("Braintree verifyWebhookChallenge error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Parse Braintree webhook notification
 * @param {string} btSignature
 * @param {string} btPayload
 * @returns {Promise<object>} webhook notification object
 */
async function parseWebhookNotification(btSignature, btPayload) {
  try {
    if (!gateway) {
      throw new Error(
        "Braintree gateway not configured. Please check your environment variables."
      );
    }
    const notification = await gateway.webhookNotification.parse(
      btSignature,
      btPayload
    );
    return notification;
  } catch (error) {
    logger?.error?.("Braintree parseWebhookNotification error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create payment method
 * @param {Object} paymentMethodData
 * @param {string} paymentMethodData.customerId - Customer ID
 * @param {string} paymentMethodData.paymentMethodNonce - Payment method nonce
 * @returns {Promise<Object>} Payment method creation result
 */
async function createPaymentMethod(paymentMethodData) {
  try {
    if (!gateway) {
      throw new Error(
        "Braintree gateway not configured. Please check your environment variables."
      );
    }

    const response = await gateway.paymentMethod.create({
      customerId: paymentMethodData.customerId,
      paymentMethodNonce: paymentMethodData.paymentMethodNonce,
    });

    if (response.success) {
      return {
        success: true,
        paymentMethod: response.paymentMethod,
      };
    } else {
      return {
        success: false,
        message: response.message,
        errors: response.errors,
      };
    }
  } catch (error) {
    logger?.error?.("Braintree createPaymentMethod error", {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Create subscription plan in Braintree
 * @param {Object} planData
 * @param {string} planData.id - Plan ID
 * @param {string} planData.name - Plan name
 * @param {string} planData.price - Plan price
 * @returns {Promise<Object>} Plan creation result
 */
async function createPlan(planData) {
  try {
    if (!gateway) {
      throw new Error(
        "Braintree gateway not configured. Please check your environment variables."
      );
    }

    const response = await gateway.plan.create({
      id: planData.id,
      name: planData.name,
      price: planData.price,
      billingFrequency: 1,
      currencyIsoCode: "USD",
    });

    if (response.success) {
      return {
        success: true,
        plan: response.plan,
      };
    } else {
      return {
        success: false,
        message: response.message,
        errors: response.errors,
      };
    }
  } catch (error) {
    logger?.error?.("Braintree createPlan error", { error: error.message });
    throw error;
  }
}

/**
 * Update subscription plan in Braintree
 * @param {string} planId - Plan ID
 * @param {Object} updateData - Update data
 * @returns {Promise<Object>} Plan update result
 */
async function updatePlan(planId, updateData) {
  try {
    if (!gateway) {
      throw new Error(
        "Braintree gateway not configured. Please check your environment variables."
      );
    }

    const response = await gateway.plan.update(planId, updateData);

    if (response.success) {
      return {
        success: true,
        plan: response.plan,
      };
    } else {
      return {
        success: false,
        message: response.message,
        errors: response.errors,
      };
    }
  } catch (error) {
    logger?.error?.("Braintree updatePlan error", { error: error.message });
    throw error;
  }
}

/**
 * Find subscription plan in Braintree
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Plan find result
 */
async function findPlan(planId) {
  try {
    if (!gateway) {
      throw new Error(
        "Braintree gateway not configured. Please check your environment variables."
      );
    }

    const response = await gateway.plan.find(planId);
    return {
      success: true,
      plan: response,
    };
  } catch (error) {
    if (error.type === "notFoundError") {
      return {
        success: false,
        notFound: true,
      };
    }
    logger?.error?.("Braintree findPlan error", { error: error.message });
    throw error;
  }
}

module.exports = {
  gateway,
  generateClientToken,
  createCustomer,
  findCustomer,
  processTransaction,
  createSubscription,
  cancelSubscription,
  findSubscription,
  createPaymentMethod,
  createPlan,
  updatePlan,
  findPlan,
  verifyWebhookChallenge,
  parseWebhookNotification,
};
