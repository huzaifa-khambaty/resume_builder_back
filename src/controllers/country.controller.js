const {
  validateCountryCreate,
  validateCountryUpdate,
  validateCountryQuery,
} = require("../validations/country.validation");
const {
  list,
  findCountryById,
  createCountry,
  updateCountryById,
  deleteCountryById,
} = require("../services/country.service");
const logger = require("../config/logger");

/**
 * GET /api/countries
 * List all countries with pagination and search
 */
async function getCountries(req, res) {
  try {
    const { valid, errors, cleaned } = validateCountryQuery(req.query || {});
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid query parameters", errors });
    }

    const result = await list(cleaned);
    return res.status(200).json({
      success: true,
      message: "Countries retrieved successfully",
      data: result.data,
    });
  } catch (err) {
    logger?.error?.("getCountries error", { error: err });
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve countries",
      error: err.message,
    });
  }
}

/**
 * GET /api/countries/:id
 * Get a single country by ID
 */
async function getCountryById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Country ID is required",
      });
    }

    const country = await findCountryById(id);
    if (!country) {
      return res.status(404).json({
        success: false,
        message: "Country not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Country retrieved successfully",
      data: country,
    });
  } catch (err) {
    logger?.error?.("getCountryById error", {
      error: err,
      countryId: req.params.id,
    });
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve country",
      error: err.message,
    });
  }
}

/**
 * POST /api/countries
 * Create a new country
 */
async function createNewCountry(req, res) {
  try {
    const { valid, errors, cleaned } = await validateCountryCreate(
      req.body || {}
    );
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload", errors });
    }

    const createdBy = req.admin?.user_id || null;
    const country = await createCountry(cleaned, createdBy);

    return res.status(201).json({
      success: true,
      message: "Country created successfully",
      data: country,
    });
  } catch (err) {
    logger?.error?.("createNewCountry error", { error: err });
    return res.status(500).json({
      success: false,
      message: "Failed to create country",
      error: err.message,
    });
  }
}

/**
 * PUT /api/countries/:id
 * Update an existing country
 */
async function updateCountry(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Country ID is required",
      });
    }

    // Check if country exists
    const existingCountry = await findCountryById(id);
    if (!existingCountry) {
      return res.status(404).json({
        success: false,
        message: "Country not found",
      });
    }

    const { valid, errors, cleaned } = await validateCountryUpdate(
      req.body || {},
      id
    );
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload", errors });
    }

    const updatedBy = req.admin?.user_id || null;
    const updatedCountry = await updateCountryById(id, cleaned, updatedBy);

    return res.status(200).json({
      success: true,
      message: "Country updated successfully",
      data: updatedCountry,
    });
  } catch (err) {
    logger?.error?.("updateCountry error", {
      error: err,
      countryId: req.params.id,
    });
    return res.status(500).json({
      success: false,
      message: "Failed to update country",
      error: err.message,
    });
  }
}

/**
 * DELETE /api/countries/:id
 * Delete a country
 */
async function deleteCountry(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Country ID is required",
      });
    }

    // Check if country exists
    const existingCountry = await findCountryById(id);
    if (!existingCountry) {
      return res.status(404).json({
        success: false,
        message: "Country not found",
      });
    }

    const deleted = await deleteCountryById(id);
    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete country",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Country deleted successfully",
    });
  } catch (err) {
    logger?.error?.("deleteCountry error", {
      error: err,
      countryId: req.params.id,
    });

    // Handle foreign key constraint errors
    if (err.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete country as it is being used by other records",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete country",
      error: err.message,
    });
  }
}

module.exports = {
  getCountries,
  getCountryById,
  createNewCountry,
  updateCountry,
  deleteCountry,
};
