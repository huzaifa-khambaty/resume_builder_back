const Joi = require('joi');

// Common validation schemas
const schemas = {
  // User registration/profile
  userProfile: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    country_code: Joi.string().length(3).required(),
    job_category_id: Joi.number().integer().positive().required(),
    phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional()
  }),

  // Resume creation
  resumeData: Joi.object({
    job_title: Joi.string().min(2).max(255).required(),
    work_location: Joi.string().min(2).max(255).required(),
    work_experiences: Joi.array().items(
      Joi.object({
        company_name: Joi.string().min(1).max(255).required(),
        job_title: Joi.string().min(1).max(255).required(),
        start_date: Joi.date().required(),
        end_date: Joi.date().optional().allow(null),
        is_current: Joi.boolean().default(false),
        description: Joi.string().max(2000).optional(),
        skills: Joi.array().items(Joi.string().max(100)).optional(),
        achievements: Joi.array().items(Joi.string().max(500)).optional()
      })
    ).min(1).required()
  }),

  // Subscription
  subscription: Joi.object({
    countries_count: Joi.number().integer().min(1).max(10).required(),
    country_codes: Joi.array().items(Joi.string().length(3)).min(1).max(10).required()
  }),

  // Simulation trigger
  simulationTrigger: Joi.object({
    resume_id: Joi.string().uuid().required(),
    country_code: Joi.string().length(3).required()
  }),

  // Admin employer upload
  employerData: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    country_code: Joi.string().length(3).required(),
    job_category_id: Joi.number().integer().positive().required(),
    industry: Joi.string().max(255).optional(),
    company_size: Joi.string().valid('Small', 'Medium', 'Large', 'Enterprise').optional()
  }),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort_by: Joi.string().optional(),
    sort_order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  // Email
  email: Joi.string().email().required(),

  // UUID
  uuid: Joi.string().uuid().required(),

  // Country code
  countryCode: Joi.string().length(3).required(),

  // Job category ID
  jobCategoryId: Joi.number().integer().positive().required()
};

// Validation middleware factory
function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    // Replace the original data with validated data
    req[property] = value;
    next();
  };
}

// Custom validation functions
function validateEmail(email) {
  const schema = Joi.string().email();
  const { error } = schema.validate(email);
  return !error;
}

function validateUUID(uuid) {
  const schema = Joi.string().uuid();
  const { error } = schema.validate(uuid);
  return !error;
}

function validateCountryCode(code) {
  const schema = Joi.string().length(3);
  const { error } = schema.validate(code);
  return !error;
}

module.exports = {
  schemas,
  validate,
  validateEmail,
  validateUUID,
  validateCountryCode
};