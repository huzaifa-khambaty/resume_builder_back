const { z } = require("zod");

// Candidate profile update schema
const candidateProfileSchema = z
  .object({
    full_name: z.string().min(1).max(255).optional(),
    phone_no: z.string().min(4).max(30).optional().nullable(),
    address: z.string().min(1).max(1000).optional().nullable(),
    country_id: z.string().uuid().optional().nullable(),
    seniority_level: z.string().min(1).max(255).optional().nullable(),
    image_url: z.string().url().optional().nullable(),
    resume_url: z.string().url().optional().nullable(),
    job_category_id: z.string().uuid().optional().nullable(),
    skills: z.any().optional().nullable(),
    work_experience: z.any().optional().nullable(),
    education: z.any().optional().nullable(),
    summary: z.string().max(2000).optional().nullable(),
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
  description: z.string().optional().nullable(),
});

const educationItem = z.object({
  degree: z.string().min(1),
  institution_name: z.string().min(1),
  location: z.string().min(1),
  start_date: isoDate,
  end_date: isoDate,
  description: z.string().optional().nullable(),
});

// Candidate resume generation payload schema
const candidateResumeSchema = z
  .object({
    candidate_name: z.string().min(1),
    job_category_id: z.union([z.string().uuid(), z.number()]),
    country_id: z.union([z.string().uuid(), z.number()]),
    email: z.string().email().optional().nullable(),
    phone_no: z.string().min(4).max(30).optional().nullable(),
    address: z.string().min(1).max(1000).optional().nullable(),
    seniority_level: z.string().min(1).optional().nullable(),
    work_experience: z.array(experienceItem).default([]),
    skills: z.array(z.string().min(1)).default([]),
    education: z.array(educationItem).default([]),
    summary: z.string().max(2000).optional().nullable(),
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
    full_name: z.string().min(1).max(255),
    phone_no: z.string().min(4).max(30).optional().nullable(),
    address: z.string().min(1).max(1000).optional().nullable(),
    seniority_level: z.string().min(1).max(255).optional().nullable(),
    job_category_id: z
      .string()
      .uuid({ message: "job_category_id must be a valid UUID" }),
    country_id: z.string().uuid({ message: "country_id must be a valid UUID" }),
    education: z.array(educationItem).optional().default([]),
    skills: z.array(z.string().min(1)).optional().default([]),
    work_experience: z.array(experienceItem).optional().default([]),
    summary: z.string().max(2000).optional().nullable(),
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

// Resume edit validation schema (same as upload but all fields optional)
const resumeEditSchema = z
  .object({
    full_name: z.string().min(1).max(255).optional(),
    phone_no: z.string().min(4).max(30).optional().nullable(),
    address: z.string().min(1).max(1000).optional().nullable(),
    seniority_level: z.string().min(1).max(255).optional().nullable(),
    job_category_id: z
      .string()
      .uuid({ message: "job_category_id must be a valid UUID" })
      .optional(),
    country_id: z
      .string()
      .uuid({ message: "country_id must be a valid UUID" })
      .optional(),
    education: z.array(educationItem).optional().default([]),
    skills: z.array(z.string().min(1)).optional().default([]),
    work_experience: z.array(experienceItem).optional().default([]),
    summary: z.string().max(2000).optional().nullable(),
  })
  .strict();

function validateResumeEdit(body) {
  const result = resumeEditSchema.safeParse(body || {});
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }
  return { valid: true, cleaned: result.data };
}

// Resume download validation schema
const resumeDownloadSchema = z
  .object({
    key: z
      .string()
      .min(1, "Resume key is required")
      .regex(
        /^resumes\/[a-f0-9-]{36}\/[^\/]+$/,
        "Invalid resume key format. Expected: resumes/{uuid}/{filename}"
      ),
  })
  .strict();

function validateResumeDownload(params) {
  const result = resumeDownloadSchema.safeParse(params || {});
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
  validateResumeEdit,
  validateResumeDownload,
};
