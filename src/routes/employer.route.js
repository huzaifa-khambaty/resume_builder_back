const express = require("express");
const { scrapEmployers } = require("../controllers/employer.controller");

const router = express.Router();

// POST /api/employer/scrap
router.post("/scrap", scrapEmployers);

module.exports = router;
