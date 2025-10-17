const { Op } = require("sequelize");

/**
 * Pagination service
 * Provides consistent pagination across all services
 */
class PaginationService {
  /**
   * Create paginated results.
   *
   * @param {Object} options - Pagination options.
   * @param {number} [options.page=1] - Page number (default: 1).
   * @param {number} [options.limit=10] - Items per page (default: 10, max: 100).
   * @param {string} [options.search=''] - Search term.
   * @param {string} [options.sortBy='created_at'] - Sort field.
   * @param {string} [options.sortOrder='DESC'] - Sort order 'ASC' or 'DESC'.
   * @param {Object} [options.whereClause={}] - Additional where conditions.
   * @param {Array} [options.attributes=null] - Fields to select.
   * @param {Array} [options.include=[]] - Associations to include.
   * @param {Object} options.model - Sequelize model.
   * @returns {Promise<Object>} Paginated response.
   */
  static async paginate(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "created_at",
      sortOrder = "DESC",
      whereClause = {},
      attributes = null,
      include = [],
      model,
    } = options;

    // Input validation and sanitization
    const currentPage = Math.max(1, parseInt(page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const searchTerm = (search || "").trim();
    const sortField = sortBy || "created_at";
    const sortDirection = ["ASC", "DESC"].includes(sortOrder?.toUpperCase())
      ? sortOrder.toUpperCase()
      : "DESC";

    const offset = (currentPage - 1) * perPage;

    // Build final where clause
    const finalWhereClause = { ...whereClause };

    // Add search functionality if searchable fields are provided
    if (searchTerm && options.searchableFields) {
      const searchConditions = options.searchableFields.map((field) => ({
        [field]: {
          [Op.iLike]: `%${searchTerm.replace(/[%_]/g, "\\$&")}%`,
        },
      }));

      if (finalWhereClause[Op.or]) {
        finalWhereClause[Op.or] = [
          ...finalWhereClause[Op.or],
          ...searchConditions,
        ];
      } else {
        finalWhereClause[Op.or] = searchConditions;
      }
    }

    // Validate sort field to prevent SQL injection
    const allowedSortFields = options.allowedSortFields || [
      "created_at",
      "updated_at",
    ];
    const finalSortBy = allowedSortFields.includes(sortField)
      ? sortField
      : "created_at";

    try {
      // Execute both queries in parallel for better performance
      const [data, totalCount] = await Promise.all([
        model.findAll({
          where: finalWhereClause,
          limit: perPage,
          offset,
          order: [[finalSortBy, sortDirection]],
          attributes,
          include,
        }),
        model.count({ where: finalWhereClause, include, distinct: true }),
      ]);

      const totalPages = Math.ceil(totalCount / perPage);
      const from = totalCount > 0 ? offset + 1 : 0;
      const to = Math.min(offset + perPage, totalCount);

      // Laravel-style pagination response
      return {
        data: {
          data: data,
          current_page: currentPage,
          from,
          last_page: totalPages,
          per_page: perPage,
          to,
          total: totalCount,
          meta: {
            search: searchTerm || null,
            sortBy: finalSortBy,
            sortOrder: sortDirection,
          },
        },
      };
    } catch (error) {
      throw new Error(`Pagination failed: ${error.message}`);
    }
  }

  /**
   * Create a simple pagination helper for basic use cases
   * @param {Object} model - Sequelize model
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Paginated results
   */
  static async simplePaginate(model, options = {}) {
    return this.paginate({
      model,
      ...options,
    });
  }
}

module.exports = PaginationService;
