const { z } = require("zod");

// Subscription Plan Validations
const createSubscriptionPlanSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .trim(),
  description: z
    .string()
    .max(1000, "Description must not exceed 1000 characters")
    .optional()
    .nullable(),
  duration_days: z
    .number()
    .int("Duration must be an integer")
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration must not exceed 365 days"),
  price_per_country: z
    .number()
    .min(0, "Price must be non-negative")
    .max(1000, "Price must not exceed 1000"),
  is_active: z.boolean().optional().default(true),
});

const updateSubscriptionPlanSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .trim()
    .optional(),
  description: z
    .string()
    .max(1000, "Description must not exceed 1000 characters")
    .optional()
    .nullable(),
  duration_days: z
    .number()
    .int("Duration must be an integer")
    .min(1, "Duration must be at least 1 day")
    .max(365, "Duration must not exceed 365 days")
    .optional(),
  price_per_country: z
    .number()
    .min(0, "Price must be non-negative")
    .max(1000, "Price must not exceed 1000")
    .optional(),
  is_active: z.boolean().optional(),
});

// Subscription Validations
const calculateSubscriptionPricingSchema = z.object({
  plan_id: z.string().uuid("Invalid plan ID format"),
  country_ids: z
    .array(z.string().uuid("Invalid country ID format"))
    .min(1, "At least one country must be selected")
    .max(50, "Cannot select more than 50 countries"),
});

const createSubscriptionSchema = z.object({
  plan_id: z.string().uuid("Invalid plan ID format"),
  country_ids: z
    .array(z.string().uuid("Invalid country ID format"))
    .min(1, "At least one country must be selected")
    .max(50, "Cannot select more than 50 countries"),
  payment_method_nonce: z.string().min(1, "Payment method nonce is required"),
});

// Query Validations
const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1))
    .refine((val) => val >= 1, "Page must be at least 1"),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10))
    .refine((val) => val >= 1 && val <= 100, "Limit must be between 1 and 100"),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["ASC", "DESC"]).optional().default("DESC"),
});

const subscriptionQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending", "active", "expired", "cancelled"]).optional(),
  candidate_id: z.string().uuid().optional(),
  plan_id: z.string().uuid().optional(),
});

const planQuerySchema = paginationQuerySchema.extend({
  is_active: z
    .string()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val === "true";
    }),
});

// Validation Functions
function validateCreateSubscriptionPlan(data) {
  try {
    const cleaned = createSubscriptionPlanSchema.parse(data);
    return { valid: true, cleaned, errors: null };
  } catch (error) {
    return {
      valid: false,
      cleaned: null,
      errors: error.errors,
    };
  }
}

function validateUpdateSubscriptionPlan(data) {
  try {
    const cleaned = updateSubscriptionPlanSchema.parse(data);
    return { valid: true, cleaned, errors: null };
  } catch (error) {
    return {
      valid: false,
      cleaned: null,
      errors: error.errors,
    };
  }
}

function validateCalculateSubscriptionPricing(data) {
  try {
    const cleaned = calculateSubscriptionPricingSchema.parse(data);
    return { valid: true, cleaned, errors: null };
  } catch (error) {
    return {
      valid: false,
      cleaned: null,
      errors: error.errors,
    };
  }
}

function validateCreateSubscription(data) {
  try {
    const cleaned = createSubscriptionSchema.parse(data);
    return { valid: true, cleaned, errors: null };
  } catch (error) {
    return {
      valid: false,
      cleaned: null,
      errors: error.errors,
    };
  }
}

function validatePaginationQuery(data) {
  try {
    const cleaned = paginationQuerySchema.parse(data);
    return { valid: true, cleaned, errors: null };
  } catch (error) {
    return {
      valid: false,
      cleaned: null,
      errors: error.errors,
    };
  }
}

function validateSubscriptionQuery(data) {
  try {
    const cleaned = subscriptionQuerySchema.parse(data);
    return { valid: true, cleaned, errors: null };
  } catch (error) {
    return {
      valid: false,
      cleaned: null,
      errors: error.errors,
    };
  }
}

function validatePlanQuery(data) {
  try {
    const cleaned = planQuerySchema.parse(data);
    return { valid: true, cleaned, errors: null };
  } catch (error) {
    return {
      valid: false,
      cleaned: null,
      errors: error.errors,
    };
  }
}

module.exports = {
  validateCreateSubscriptionPlan,
  validateUpdateSubscriptionPlan,
  validateCalculateSubscriptionPricing,
  validateCreateSubscription,
  validatePaginationQuery,
  validateSubscriptionQuery,
  validatePlanQuery,
};
