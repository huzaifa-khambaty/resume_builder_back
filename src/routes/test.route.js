const express = require("express");
const { testGpt } = require("../controllers/gpt.controller");

const router = express.Router();

// Test GPT endpoint
// POST /api/test/gpt
router.post("/gpt", testGpt);

module.exports = router;
