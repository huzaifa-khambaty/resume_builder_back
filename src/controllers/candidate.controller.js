const {
  validateCandidateProfileUpdate,
} = require("../validations/candidate.validation");
const { updateCandidateById } = require("../services/candidate.service");

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
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: err.message,
    });
  }
}

module.exports = {
  updateCandidateProfile,
};
