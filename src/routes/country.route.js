const express = require("express");
const router = express.Router();
const { checkAdminAuth } = require("../middlewares/auth.middleware");
const {
  getCountries,
  getCountryById,
  createNewCountry,
  updateCountry,
  deleteCountry,
} = require("../controllers/country.controller");

// GET /api/countries - List all countries with pagination and search
router.get("/", getCountries);

// GET /api/countries/:id - Get a single country by ID
router.get("/:id", getCountryById);

// POST /api/countries - Create a new country (requires admin authentication)
router.post("/", checkAdminAuth, createNewCountry);

// PUT /api/countries/:id - Update an existing country (requires admin authentication)
router.put("/:id", checkAdminAuth, updateCountry);

// DELETE /api/countries/:id - Delete a country (requires admin authentication)
router.delete("/:id", checkAdminAuth, deleteCountry);

module.exports = router;
