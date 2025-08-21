const express = require("express");
const {
  scrapEmployers,
  listEmployers,
} = require("../controllers/employer.controller");
const { checkAdminAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

// POST /api/employer/scrap
router.post("/scrap", checkAdminAuth, scrapEmployers);

// GET /api/employer
router.get("/", checkAdminAuth, listEmployers);

module.exports = router;
