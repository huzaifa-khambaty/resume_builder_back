const { z } = require("zod");
const {
  countryExistsByName,
  countryExistsByCode,
} = require("../services/country.service");

// Country creation/update schema
const countrySchema = z
  .object({
    country: z.string().min(1).max(255),
    country_code: z.string().min(2).max(10),
    description: z.string().max(5000).optional().nullable(),
    sort_order: z.coerce.number().int().positive().optional(),
  })
  .strict();

function validateCountryPayload(body) {
  const result = countrySchema.safeParse(body);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }
  return { valid: true, cleaned: result.data };
}

// Async validation for country creation
async function validateCountryCreate(body) {
  const basicValidation = validateCountryPayload(body);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  const { country, country_code } = basicValidation.cleaned;

  // Check for duplicate country name
  const nameExists = await countryExistsByName(country);
  if (nameExists) {
    return {
      valid: false,
      errors: {
        fieldErrors: {
          country: ["Country with this name already exists"],
        },
      },
    };
  }

  // Check for duplicate country code
  const codeExists = await countryExistsByCode(country_code);
  if (codeExists) {
    return {
      valid: false,
      errors: {
        fieldErrors: {
          country_code: ["Country with this code already exists"],
        },
      },
    };
  }

  return { valid: true, cleaned: basicValidation.cleaned };
}

// Async validation for country update
async function validateCountryUpdate(body, excludeId) {
  const basicValidation = validateCountryPayload(body);
  if (!basicValidation.valid) {
    return basicValidation;
  }

  const { country, country_code } = basicValidation.cleaned;

  // Check for duplicate country name (excluding current country)
  if (country) {
    const nameExists = await countryExistsByName(country, excludeId);
    if (nameExists) {
      return {
        valid: false,
        errors: {
          fieldErrors: {
            country: ["Country with this name already exists"],
          },
        },
      };
    }
  }

  // Check for duplicate country code (excluding current country)
  if (country_code) {
    const codeExists = await countryExistsByCode(country_code, excludeId);
    if (codeExists) {
      return {
        valid: false,
        errors: {
          fieldErrors: {
            country_code: ["Country with this code already exists"],
          },
        },
      };
    }
  }

  return { valid: true, cleaned: basicValidation.cleaned };
}

// Country query parameters schema
const countryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  sortBy: z
    .enum(['country', 'country_code', 'sort_order', 'created_at', 'updated_at'])
    .default('sort_order'),
  sortOrder: z.enum(['ASC', 'DESC']).default('ASC'),
});

function validateCountryQuery(query) {
  const result = countryQuerySchema.safeParse(query);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }
  return { valid: true, cleaned: result.data };
}

module.exports = {
  validateCountryPayload,
  validateCountryCreate,
  validateCountryUpdate,
  validateCountryQuery,
};
