const { z } = require("zod");

// Admin (User) profile update schema
const adminProfileSchema = z
  .object({
    full_name: z.string().min(1).max(255).optional(),
    // Admin email change is often separate; block here by default
    email: z.never().optional(),
    is_active: z.never().optional(),
    api_token: z.never().optional(),
    created_by: z.never().optional(),
    updated_by: z.never().optional(),
  })
  .strict();

function validateAdminProfileUpdate(body) {
  const result = adminProfileSchema.safeParse(body);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }
  return { valid: true, cleaned: result.data };
}

module.exports = {
  validateAdminProfileUpdate,
};
