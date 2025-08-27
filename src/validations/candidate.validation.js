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

// Helper schema fragments
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("YYYY-MM-DD");

const experienceItem = z.object({
  job_title: z.string().min(1),
  company_name: z.string().min(1),
  location: z.string().min(1),
  start_date: isoDate,
  end_date: z.string().nullable().optional(),
  description: z.string().min(1),
});

const educationItem = z.object({
  degree: z.string().min(1),
  institution_name: z.string().min(1),
  location: z.string().min(1),
  start_date: isoDate,
  end_date: isoDate,
  description: z.string().min(1),
});

// Candidate resume generation payload schema
const candidateResumeSchema = z
  .object({
    candidate_name: z.string().min(1),
    job_category_id: z.union([z.string().uuid(), z.number()]),
    country_id: z.union([z.string().uuid(), z.number()]),
    email: z.string().email().optional().nullable(),
    seniority_level: z.string().min(1).optional().nullable(),
    work_experience: z.array(experienceItem).default([]),
    skills: z.array(z.string().min(1)).default([]),
    education: z.array(educationItem).default([]),
  })
  .strict();

function validateGenerateResumePayload(body) {
  const result = candidateResumeSchema.safeParse(body || {});
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }
  return { valid: true, cleaned: result.data };
}

// Resume upload validation schema
const resumeUploadSchema = z
  .object({
    skills: z.array(z.string().min(1)).optional().default([]),
    work_experience: z.array(experienceItem).optional().default([]),
  })
  .strict();

function validateResumeUpload(body) {
  const result = resumeUploadSchema.safeParse(body || {});
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
  validateGenerateResumePayload,
  validateResumeUpload,
};
