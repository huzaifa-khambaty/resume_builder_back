const express = require("express");
const { getLookup } = require("../controllers/lookup.controller");

const router = express.Router();

// GET /api/lookup/:entity
// Example: /api/lookup/countries?search=pak&page=1&limit=10
router.get("/:entity", getLookup);

module.exports = router;
