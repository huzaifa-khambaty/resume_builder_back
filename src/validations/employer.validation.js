const { z } = require("zod");

// Validate input for employer scraping
const employerScrapSchema = z
  .object({
    country_id: z.string().uuid({ message: "country_id must be a valid UUID" }),
    job_category_id: z
      .string()
      .uuid({ message: "job_category_id must be a valid UUID" }),
  })
  .strict();

function validateEmployerScrapInput(bodyOrParams) {
  const result = employerScrapSchema.safeParse(bodyOrParams);
  if (!result.success) {
    return { valid: false, errors: result.error.flatten() };
  }
  return { valid: true, cleaned: result.data };
}

module.exports = {
  validateEmployerScrapInput,
};
