const { z } = require("zod");

// Candidate profile update schema
const candidateProfileSchema = z
  .object({
    full_name: z.string().min(1).max(255).optional(),
    country_id: z.string().uuid().optional().nullable(),
    seniority_level: z.string().min(1).max(255).optional().nullable(),
    image_url: z.string().url().optional().nullable(),
    resume_url: z.string().url().optional().nullable(),
    job_category_id: z.string().uuid().optional().nullable(),
    skills: z.any().optional().nullable(),
    work_experience: z.any().optional().nullable(),
    education: z.any().optional().nullable(),
    // explicitly disallow password updates here
    password: z.never().optional(),
    email: z.never().optional(),
    is_active: z.never().optional(),
    api_token: z.never().optional(),
    created_by: z.never().optional(),
    updated_by: z.never().optional(),
  })
  .strict();

function validateCandidateProfileUpdate(body) {
  const result = candidateProfileSchema.safeParse(body);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }
  return { valid: true, cleaned: result.data };
}

module.exports = {
  validateCandidateProfileUpdate,
};
