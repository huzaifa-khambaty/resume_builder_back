const { lookup, isSupportedEntity } = require("../services/lookup.service");

const getLookup = async (req, res) => {
  try {
    const { entity } = req.params;
    const { page, limit, search, sortBy, sortOrder } = req.query;

    if (!isSupportedEntity(entity)) {
      return res.status(404).json({
        success: false,
        message: `Lookup entity '${entity}' is not supported`,
      });
    }

    const result = await lookup(entity, {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      exclude_country_ids: req.query.exclude_country_ids,
      "exclude_country_ids[]": req.query["exclude_country_ids[]"],
    });

    return res.status(200).json({
      success: true,
      message: `${entity} fetched successfully`,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    console.error("Error in getLookup:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch lookup data",
      error: error.message,
    });
  }
};

module.exports = { getLookup };
