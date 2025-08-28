const logger = require("../config/logger");
const { getValidationErrorMessage } = require("../utils/errorHelper");
const {
  validateEmployerScrapInput,
  validateEmployerListQuery,
} = require("../validations/employer.validation");
const {
  getCountryAndCategoryByIds,
  buildEmployerPrompt,
  callOpenAIForEmployers,
  saveEmployers,
  listEmployers: listEmployersService,
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
        .json({ success: false, message: getValidationErrorMessage(errors) });
    }

    const { country_id, job_category_id } = cleaned;

    const info = await getCountryAndCategoryByIds(country_id, job_category_id);
    const prompt = buildEmployerPrompt(info);

    const { parsed } = await callOpenAIForEmployers(prompt);

    // Determine actorId for auditing
    const actorId = req.admin?.user_id;

    // Persist employers automatically
    const saveResult = await saveEmployers(
      parsed,
      country_id,
      job_category_id,
      actorId
    );

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

// GET /api/employer
async function listEmployers(req, res) {
  try {
    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      country_id,
      sector,
      city,
      confidence,
      website,
      name,
    } = req.query;

    const result = await listEmployersService({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      country_id,
      sector,
      city,
      confidence,
      website,
      name,
    });

    return res.status(200).json({
      success: true,
      message: "Employers fetched successfully",
      data: {
        data: result.data,
        ...result.meta,
      },
    });
  } catch (error) {
    logger?.error?.("listEmployers error", { error });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employers",
      error: error.message,
    });
  }
}

module.exports = { scrapEmployers, listEmployers };
