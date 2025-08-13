const { Op } = require("sequelize");

/**
 * Laravel-style pagination service
 * Provides consistent pagination across all services
 */
class PaginationService {
  /**
   * Create paginated results in Laravel format
   * @param {Object} options - Pagination options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Items per page (default: 10, max: 100)
   * @param {string} options.search - Search term
   * @param {string} options.sortBy - Sort field
   * @param {string} options.sortOrder - Sort order 'ASC' or 'DESC'
   * @param {Object} options.whereClause - Additional where conditions
   * @param {Array} options.attributes - Fields to select
   * @param {Array} options.include - Associations to include
   * @param {Object} options.model - Sequelize model
   * @returns {Promise<Object>} Laravel-style paginated response
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
      model
    } = options;

    // Input validation and sanitization
    const currentPage = Math.max(1, parseInt(page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const searchTerm = (search || "").trim();
    const sortField = sortBy || 'created_at';
    const sortDirection = ['ASC', 'DESC'].includes(sortOrder?.toUpperCase()) 
      ? sortOrder.toUpperCase() 
      : 'DESC';
    
    const offset = (currentPage - 1) * perPage;

    // Build final where clause
    const finalWhereClause = { ...whereClause };
    
    // Add search functionality if searchable fields are provided
    if (searchTerm && options.searchableFields) {
      const searchConditions = options.searchableFields.map(field => ({
        [field]: {
          [Op.iLike]: `%${searchTerm.replace(/[%_]/g, '\\$&')}%`
        }
      }));
      
      if (finalWhereClause[Op.or]) {
        finalWhereClause[Op.or] = [...finalWhereClause[Op.or], ...searchConditions];
      } else {
        finalWhereClause[Op.or] = searchConditions;
      }
    }

    // Validate sort field to prevent SQL injection
    const allowedSortFields = options.allowedSortFields || ['created_at', 'updated_at'];
    const finalSortBy = allowedSortFields.includes(sortField) ? sortField : 'created_at';

    try {
      // Execute both queries in parallel for better performance
      const [data, totalCount] = await Promise.all([
        model.findAll({
          where: finalWhereClause,
          limit: perPage,
          offset,
          order: [[finalSortBy, sortDirection]],
          attributes,
          include
        }),
        model.count({ where: finalWhereClause })
      ]);

      const totalPages = Math.ceil(totalCount / perPage);
      const from = totalCount > 0 ? offset + 1 : 0;
      const to = Math.min(offset + perPage, totalCount);

      // Laravel-style pagination response
      return {
        data,
        pagination: {
          current_page: currentPage,
          data: data,
          first_page_url: this.buildPageUrl(1, options),
          from,
          last_page: totalPages,
          last_page_url: this.buildPageUrl(totalPages, options),
          links: this.buildPaginationLinks(currentPage, totalPages, options),
          next_page_url: currentPage < totalPages ? this.buildPageUrl(currentPage + 1, options) : null,
          path: options.path || '/',
          per_page: perPage,
          prev_page_url: currentPage > 1 ? this.buildPageUrl(currentPage - 1, options) : null,
          to,
          total: totalCount
        },
        meta: {
          search: searchTerm || null,
          sortBy: finalSortBy,
          sortOrder: sortDirection
        }
      };
    } catch (error) {
      throw new Error(`Pagination failed: ${error.message}`);
    }
  }

  /**
   * Build pagination links array (Laravel format)
   * @param {number} currentPage - Current page number
   * @param {number} totalPages - Total number of pages
   * @param {Object} options - Additional options for URL building
   * @returns {Array} Array of pagination links
   */
  static buildPaginationLinks(currentPage, totalPages, options = {}) {
    const links = [];
    
    // Previous page link
    if (currentPage > 1) {
      links.push({
        url: this.buildPageUrl(currentPage - 1, options),
        label: '&laquo; Previous',
        active: false
      });
    }

    // Page number links
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      links.push({
        url: this.buildPageUrl(i, options),
        label: i.toString(),
        active: i === currentPage
      });
    }

    // Next page link
    if (currentPage < totalPages) {
      links.push({
        url: this.buildPageUrl(currentPage + 1, options),
        label: 'Next &raquo;',
        active: false
      });
    }

    return links;
  }

  /**
   * Build page URL with query parameters
   * @param {number} page - Page number
   * @param {Object} options - Options containing query parameters
   * @returns {string} URL with query parameters
   */
  static buildPageUrl(page, options = {}) {
    const { path = '/', queryParams = {} } = options;
    const params = new URLSearchParams({
      ...queryParams,
      page: page.toString()
    });
    
    return `${path}?${params.toString()}`;
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
      ...options
    });
  }
}

module.exports = PaginationService;
