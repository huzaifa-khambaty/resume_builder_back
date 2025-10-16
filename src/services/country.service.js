const { v4: uuidv4 } = require("uuid");
const { Op } = require("sequelize");
const { Country, Candidate, Employer } = require("../models");
const PaginationService = require("./pagination.service");

/**
 * Get all countries with pagination and search
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1, min: 1)
 * @param {number} options.limit - Items per page (default: 10, min: 1, max: 100)
 * @param {string} options.search - Search term for country name or code
 * @param {string} options.sortBy - Sort field (default: 'created_at')
 * @param {string} options.sortOrder - Sort order 'ASC' or 'DESC' (default: 'DESC')
 * @returns {Promise<Object>} - Returns Laravel-style paginated results
 */
async function list(options = {}) {
  try {
    const result = await PaginationService.paginate({
      model: Country,
      page: options.page,
      limit: options.limit,
      search: options.search,
      sortBy: options.sortBy || "sort_order",
      sortOrder: options.sortOrder || "ASC",
      attributes: [
        "country_id",
        "country",
        "country_code",
        "description",
        "sort_order",
        "created_at",
        "updated_at",
      ],
      searchableFields: ["country", "country_code"],
      allowedSortFields: [
        "country",
        "country_code",
        "sort_order",
        "created_at",
        "updated_at",
      ],
      path: "/api/countries",
    });

    return result;
  } catch (error) {
    throw new Error(`Failed to fetch countries: ${error.message}`);
  }
}

/**
 * Find country by ID
 * @param {string} countryId
 * @returns {Promise<Country|null>}
 */
async function findCountryById(countryId) {
  return Country.findOne({
    where: { country_id: countryId },
    attributes: [
      "country_id",
      "country",
      "country_code",
      "description",
      "sort_order",
      "created_at",
      "updated_at",
    ],
  });
}

/**
 * Find country by country name
 * @param {string} country
 * @returns {Promise<Country|null>}
 */
async function findCountryByName(country) {
  return Country.findOne({
    where: { country },
    attributes: [
      "country_id",
      "country",
      "country_code",
      "description",
      "sort_order",
      "created_at",
      "updated_at",
    ],
  });
}

/**
 * Find country by country code
 * @param {string} countryCode
 * @returns {Promise<Country|null>}
 */
async function findCountryByCode(countryCode) {
  return Country.findOne({
    where: { country_code: countryCode },
    attributes: [
      "country_id",
      "country",
      "country_code",
      "description",
      "sort_order",
      "created_at",
      "updated_at",
    ],
  });
}

/**
 * Create a new country
 * @param {Object} data - Country data
 * @param {string} data.country - Country name
 * @param {string} data.country_code - Country code
 * @param {string} createdBy - ID of the user creating the country
 * @returns {Promise<Country>}
 */
async function createCountry(data, createdBy = null) {
  const countryId = uuidv4();
  // Determine next sort order automatically
  const currentMax = await Country.max('sort_order');
  const nextOrder = (Number.isFinite(currentMax) ? currentMax : 0) + 1;
  const payload = {
    country_id: countryId,
    country: data.country,
    country_code: data.country_code,
    description: data.description,
    // Ignore client-provided sort_order. Auto-increment.
    sort_order: nextOrder,
    created_by: createdBy || countryId,
  };
  return Country.create(payload);
}

/**
 * Update country by ID
 * @param {string} countryId
 * @param {Object} data - Updated country data
 * @param {string} updatedBy - ID of the user updating the country
 * @returns {Promise<Country>}
 */
async function updateCountryById(countryId, data, updatedBy = null) {
  const allowed = {
    country: data.country,
    country_code: data.country_code,
    description: data.description,
    // sort_order is system-managed; do not allow manual updates here
    updated_by: updatedBy,
  };

  // Remove undefined keys
  Object.keys(allowed).forEach((k) =>
    allowed[k] === undefined ? delete allowed[k] : null
  );

  await Country.update(allowed, { where: { country_id: countryId } });
  return findCountryById(countryId);
}

/**
 * Delete country by ID
 * @param {string} countryId
 * @returns {Promise<boolean>} - Returns true if deleted successfully
 * @throws {Error} - Throws error if country is referenced in other tables
 */
async function deleteCountryById(countryId) {
  try {
    const deleted = await Country.destroy({
      where: { country_id: countryId },
    });
    return deleted > 0;
  } catch (error) {
    // Handle foreign key constraint violations
    if (error.name === "SequelizeForeignKeyConstraintError") {
      throw new Error(
        "Cannot delete country. It is currently being used by candidates or employers."
      );
    }
    throw error;
  }
}

/**
 * Check if country exists by name (excluding current country for updates)
 * @param {string} country - Country name
 * @param {string} excludeId - Country ID to exclude from check
 * @returns {Promise<boolean>}
 */
async function countryExistsByName(country, excludeId = null) {
  const where = { country };
  if (excludeId) {
    where.country_id = { [Op.ne]: excludeId };
  }

  const existing = await Country.findOne({ where });
  return !!existing;
}

/**
 * Check if country exists by code (excluding current country for updates)
 * @param {string} countryCode - Country code
 * @param {string} excludeId - Country ID to exclude from check
 * @returns {Promise<boolean>}
 */
async function countryExistsByCode(countryCode, excludeId = null) {
  const where = { country_code: countryCode };
  if (excludeId) {
    where.country_id = { [Op.ne]: excludeId };
  }

  const existing = await Country.findOne({ where });
  return !!existing;
}

module.exports = {
  list,
  findCountryById,
  findCountryByName,
  findCountryByCode,
  createCountry,
  updateCountryById,
  deleteCountryById,
  countryExistsByName,
  countryExistsByCode,
};
