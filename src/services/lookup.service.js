const { Country, JobCategory } = require("../models");
const PaginationService = require("./pagination.service");

// Map supported lookup entities to their configs
const ENTITY_CONFIG = {
  countries: {
    model: Country,
    attributes: [
      "country_id",
      "country",
      "country_code",
      "created_at",
      "updated_at",
    ],
    searchableFields: ["country", "country_code"],
    allowedSortFields: ["country", "country_code", "created_at", "updated_at"],
    defaultSortBy: "country",
    path: "/api/lookup/countries",
  },
  "job-categories": {
    model: JobCategory,
    attributes: ["job_category_id", "job_category", "created_at", "updated_at"],
    searchableFields: ["job_category"],
    allowedSortFields: ["job_category", "created_at", "updated_at"],
    defaultSortBy: "job_category",
    path: "/api/lookup/job-categories",
  },
};

function isSupportedEntity(entity) {
  return Boolean(ENTITY_CONFIG[entity]);
}

async function lookup(entity, options = {}) {
  const cfg = ENTITY_CONFIG[entity];
  if (!cfg) {
    throw new Error(`Unsupported entity: ${entity}`);
  }

  const {
    model,
    attributes,
    searchableFields,
    allowedSortFields,
    defaultSortBy,
    path,
  } = cfg;

  const result = await PaginationService.paginate({
    model,
    page: options.page,
    limit: options.limit,
    search: options.search,
    sortBy: options.sortBy || defaultSortBy,
    sortOrder: options.sortOrder || "ASC",
    attributes,
    searchableFields,
    allowedSortFields,
    path,
  });

  return result;
}

module.exports = { lookup, isSupportedEntity };
