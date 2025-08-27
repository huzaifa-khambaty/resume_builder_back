const express = require("express");
const multer = require("multer");
const router = express.Router();
const { checkAuth } = require("../middlewares/auth.middleware");
const {
  updateCandidateProfile,
  generateResume,
  uploadResumeFile,
} = require("../controllers/candidate.controller");

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

router.put("/profile", checkAuth, updateCandidateProfile);
router.post("/resume", checkAuth, generateResume);
router.post("/resume/upload", checkAuth, upload.single('resume'), uploadResumeFile);

module.exports = router;
