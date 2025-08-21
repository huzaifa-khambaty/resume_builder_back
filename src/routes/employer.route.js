const express = require("express");
const { scrapEmployers } = require("../controllers/employer.controller");
const { checkAdminAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

// POST /api/employer/scrap
router.post("/scrap", checkAdminAuth, scrapEmployers);

module.exports = router;
