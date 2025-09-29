const express = require("express");
const multer = require("multer");
const router = express.Router();
const { checkAuth } = require("../middlewares/auth.middleware");
const {
  updateCandidateProfile,
  generateResume,
  uploadResumeFile,
  editResumeFile,
  downloadResumeFile,
  downloadCurrentResume,
  getJobList,
  getEmployersForCandidate,
  getCandidateDashboard,
  getChartsByJobCategory,
} = require("../controllers/candidate.controller");
const { addSimulation } = require("../controllers/simulation.controller");

// Configure multer for file upload (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

router.put("/profile", checkAuth, updateCandidateProfile);
router.post("/resume", checkAuth, generateResume);
router.post(
  "/resume/upload",
  checkAuth,
  upload.single("resume"),
  uploadResumeFile
);
router.put("/resume/edit", checkAuth, upload.single("resume"), editResumeFile);
router.get("/resume/download", checkAuth, downloadResumeFile);
router.get("/resume/current", checkAuth, downloadCurrentResume);
router.get("/job-list", checkAuth, getJobList);
router.get("/employers", checkAuth, getEmployersForCandidate);
router.get("/dashboard", checkAuth, getCandidateDashboard);
router.get("/charts/:job_category_id", checkAuth, getChartsByJobCategory);

// Subscription routes
router.use("/subscriptions", require("./subscription.route"));

// Simulations routes
router.post("/simulations", checkAuth, addSimulation);

module.exports = router;
