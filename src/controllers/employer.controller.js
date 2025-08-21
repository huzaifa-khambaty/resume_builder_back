const logger = require("../config/logger");
const {
  validateEmployerScrapInput,
} = require("../validations/employer.validation");
const {
  getCountryAndCategoryByIds,
  buildEmployerPrompt,
  callOpenAIForEmployers,
  saveEmployers,
} = require("../services/employer.service");

// POST /api/employer/scrap
// Accepts: country_id and job_category_id in body or params (or query as fallback)
async function scrapEmployers(req, res, next) {
  try {
    const merged = {
      ...(req.body || {}),
      ...(req.params || {}),
      ...(req.query || {}),
    };

    const { valid, errors, cleaned } = validateEmployerScrapInput(merged);
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload", errors });
    }

    const { country_id, job_category_id } = cleaned;

    const info = await getCountryAndCategoryByIds(country_id, job_category_id);
    const prompt = buildEmployerPrompt(info);

    const { parsed } = await callOpenAIForEmployers(prompt);

    // Determine actorId for auditing
    const actorId = req.admin?.user_id;

    // Persist employers automatically
    const saveResult = await saveEmployers(parsed, country_id, actorId);

    return res.status(200).json({
      success: true,
      message: "Employers scraped successfully",
      data: saveResult,
    });
  } catch (error) {
    logger?.error?.("scrapEmployers error", { error });
    const status = error.status || 500;
    return res
      .status(status)
      .json({ success: false, message: error.message, details: error.details });
  }
}

module.exports = { scrapEmployers };
