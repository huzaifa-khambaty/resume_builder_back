const { z } = require("zod");

// Validate input for employer scraping
const employerScrapSchema = z
  .object({
    country_id: z
      .string({ required_error: "country_id is required" })
      .uuid({ message: "country_id must be a valid UUID" }),
    job_category_id: z
      .string({ required_error: "job_category_id is required" })
      .uuid({ message: "job_category_id must be a valid UUID" }),
  })
  .strict();

// Validate query parameters for employer listing
const employerListSchema = z
  .object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    country_id: z.string().uuid().optional(),
    sector: z.string().optional(),
    city: z.string().optional(),
    confidence: z.string().refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, { message: "confidence must be a number between 0 and 100" }).optional(),
    website: z.string().optional(),
    name: z.string().optional(),
  });

function validateEmployerScrapInput(bodyOrParams) {
  const result = employerScrapSchema.safeParse(bodyOrParams);
  if (!result.success) {
    return { valid: false, errors: result.error.flatten() };
  }
  return { valid: true, cleaned: result.data };
}

function validateEmployerListQuery(queryParams) {
  const result = employerListSchema.safeParse(queryParams);
  if (!result.success) {
    return { valid: false, errors: result.error.flatten() };
  }
  return { valid: true, cleaned: result.data };
}

module.exports = {
  validateEmployerScrapInput,
  validateEmployerListQuery,
};
