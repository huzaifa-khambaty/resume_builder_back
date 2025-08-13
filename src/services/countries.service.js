const { Country } = require("../models");
const PaginationService = require("./pagination.service");

/**
 * Get all countries with pagination and search
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1, min: 1)
 * @param {number} options.limit - Items per page (default: 10, min: 1, max: 100)
 * @param {string} options.search - Search term for country name or code
 * @param {string} options.sortBy - Sort field (default: 'country')
 * @param {string} options.sortOrder - Sort order 'ASC' or 'DESC' (default: 'ASC')
 * @returns {Promise<Object>} - Returns Laravel-style paginated results
 */
async function list(options = {}) {
  try {
    const result = await PaginationService.paginate({
      model: Country,
      page: options.page,
      limit: options.limit,
      search: options.search,
      sortBy: options.sortBy || 'country',
      sortOrder: options.sortOrder || 'ASC',
      attributes: ['country_id', 'country', 'country_code', 'created_at', 'updated_at'],
      searchableFields: ['country', 'country_code'],
      allowedSortFields: ['country', 'country_code', 'created_at', 'updated_at'],
      path: '/api/countries'
    });

    return result;
  } catch (error) {
    throw new Error(`Failed to fetch countries: ${error.message}`);
  }
}

module.exports = {
  list,
};
