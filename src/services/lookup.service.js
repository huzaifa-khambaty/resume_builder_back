const { Op } = require("sequelize");
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

  // Optional where clause to support exclusions for specific entities
  let whereClause = {};
  if (entity === "countries") {
    // normalize exclude ids from various possible shapes
    let excludeIds = [];
    const rawA = options.exclude_country_ids;
    const rawB = options["exclude_country_ids[]"]; // support bracket notation
    const raw = Array.isArray(rawA) || Array.isArray(rawB)
      ? [...(Array.isArray(rawA) ? rawA : []), ...(Array.isArray(rawB) ? rawB : [])]
      : (rawA ?? rawB);

    if (raw) {
      if (Array.isArray(raw)) {
        excludeIds = raw.filter(Boolean);
      } else if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              excludeIds = parsed.filter(Boolean);
            }
          } catch (_) {
            excludeIds = trimmed
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
        } else {
          excludeIds = trimmed
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }

    if (excludeIds.length > 0) {
      whereClause = {
        country_id: {
          [Op.notIn]: excludeIds,
        },
      };
    }
  }

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
    whereClause,
  });

  return result;
}

module.exports = { lookup, isSupportedEntity };
