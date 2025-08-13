const {
  list
  
} = require("../services/countries.service");

const lists = async (req, res) => {
  try {
    // Extract and validate query parameters
    const { page, limit, search, sortBy, sortOrder } = req.query;
    
    // Validate numeric parameters
    if (page && (isNaN(page) || parseInt(page) < 1)) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive integer"
      });
    }
    
    if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
      return res.status(400).json({
        success: false,
        message: "Limit must be between 1 and 100"
      });
    }
    
    // Call service with pagination and search options
    const result = await list({ page, limit, search, sortBy, sortOrder });
    
    res.status(200).json({ 
      success: true, 
      message: "Countries fetched successfully", 
      data: result.countries,
      pagination: result.pagination,
      meta: result.meta
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch countries",
      error: error.message 
    });
  }
};

module.exports = {
  lists,
};
