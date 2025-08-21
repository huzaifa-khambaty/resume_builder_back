const express = require("express");
const router = express.Router();
const { checkAuth } = require("../middlewares/auth.middleware");
const {
  updateCandidateProfile,
  generateResume,
} = require("../controllers/candidate.controller");

router.put("/profile", checkAuth, updateCandidateProfile);
router.post("/resume", checkAuth, generateResume);

module.exports = router;
