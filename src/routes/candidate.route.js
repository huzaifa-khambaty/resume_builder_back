const express = require("express");
const router = express.Router();
const { checkAuth } = require("../middlewares/auth.middleware");
const {
  updateCandidateProfile,
} = require("../controllers/candidate.controller");

router.put("/profile", checkAuth, updateCandidateProfile);

module.exports = router;
