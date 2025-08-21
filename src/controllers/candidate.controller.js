const {
  validateCandidateProfileUpdate,
  validateGenerateResumePayload,
} = require("../validations/candidate.validation");
const {
  updateCandidateById,
  generateResumeFromProfile,
} = require("../services/candidate.service");
const logger = require("../config/logger");

async function updateCandidateProfile(req, res) {
  try {
    const { valid, errors, cleaned } = validateCandidateProfileUpdate(
      req.body || {}
    );
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload", errors });
    }

    const candidateId = req.candidate.candidate_id;
    const updated = await updateCandidateById(candidateId, {
      ...cleaned,
      updated_by: candidateId,
    });
    const { password, api_token, ...candidate } = updated.toJSON();
    return res.status(200).json({
      success: true,
      message: "Profile updated",
      data: { ...candidate },
    });
  } catch (err) {
    logger?.error?.("updateCandidateProfile error", { error: err });
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: err.message,
    });
  }
}

// POST /api/candidate/resume
async function generateResume(req, res) {
  try {
    const { valid, errors, cleaned } = validateGenerateResumePayload(
      req.body || {}
    );
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload", errors });
    }

    const data = await generateResumeFromProfile({
      ...cleaned,
      // ensure email and seniority_level are available to the service/prompt
      email: req?.candidate?.email || cleaned.email,
      seniority_level: req?.candidate?.seniority_level || cleaned.seniority_level,
    });

    return res.status(200).json({
      success: true,
      message: "Resume generated successfully",
      data,
    });
  } catch (error) {
    logger?.error?.("generateResume error", { error });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to generate resume",
      details: error.details,
    });
  }
}

module.exports = {
  updateCandidateProfile,
  generateResume,
};
