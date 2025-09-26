const { z } = require("zod");

// Schema for creating a simulation record
const addSimulationSchema = z
  .object({
    country_id: z.string().uuid({ message: "country_id must be UUID" }),
    job_category_id: z
      .string()
      .uuid({ message: "job_category_id must be UUID" }),
    no_of_jobs: z.number().int().min(0).optional().default(0),
    short_listed: z.number().int().min(0).optional().default(0),
  })
  .strict();

function validateAddSimulation(body) {
  const result = addSimulationSchema.safeParse(body || {});
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.flatten(),
    };
  }
  return { valid: true, cleaned: result.data };
}

module.exports = { validateAddSimulation };
