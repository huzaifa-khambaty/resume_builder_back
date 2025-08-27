const {
  validateCandidateProfileUpdate,
  validateGenerateResumePayload,
  validateResumeUpload,
} = require("../validations/candidate.validation");
const {
  updateCandidateById,
  generateResumeFromProfile,
} = require("../services/candidate.service");
const {
  uploadResume,
  extractKeyFromUrl,
  deleteFile,
  generateUrlFromKey,
} = require("../services/s3.service");
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
      seniority_level:
        req?.candidate?.seniority_level || cleaned.seniority_level,
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

// POST /api/candidate/resume/upload
async function uploadResumeFile(req, res) {
  try {
    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No resume file uploaded",
      });
    }

    // Validate file type (PDF only)
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({
        success: false,
        message: "Only PDF files are allowed for resume upload",
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "Resume file size must be less than 5MB",
      });
    }

    // Parse JSON strings from form-data
    let parsedBody = { ...req.body };

    // Parse skills if provided
    if (parsedBody.skills && typeof parsedBody.skills === "string") {
      try {
        parsedBody.skills = JSON.parse(parsedBody.skills);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid skills format. Must be valid JSON array.",
        });
      }
    }

    // Parse work_experience if provided
    if (
      parsedBody.work_experience &&
      typeof parsedBody.work_experience === "string"
    ) {
      try {
        parsedBody.work_experience = JSON.parse(parsedBody.work_experience);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid work_experience format. Must be valid JSON array.",
        });
      }
    }

    // Validate additional data (skills and work_experience)
    const { valid, errors, cleaned } = validateResumeUpload(parsedBody);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid resume data",
        errors,
      });
    }

    const candidateId = req.candidate.candidate_id;

    // Get current candidate to check for existing resume
    const currentCandidate =
      await require("../services/candidate.service").findCandidateById(
        candidateId
      );

    // Delete old resume from S3 if exists
    if (currentCandidate?.resume_key) {
      try {
        await deleteFile(currentCandidate.resume_key);
        logger?.info?.("Old resume deleted from S3", { candidateId, oldKey: currentCandidate.resume_key });
      } catch (deleteError) {
        logger?.warn?.("Failed to delete old resume", {
          candidateId,
          error: deleteError.message,
        });
        // Continue with upload even if old file deletion fails
      }
    }

    // Upload new resume to S3
    const uploadResult = await uploadResume(
      req.file.buffer,
      req.file.originalname,
      candidateId
    );

    if (!uploadResult.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to upload resume to cloud storage",
      });
    }

    // Update candidate with new resume key and additional data
    const updateData = {
      resume_key: uploadResult.key,
      skills: cleaned.skills,
      work_experience: cleaned.work_experience,
      updated_by: candidateId,
    };

    const updatedCandidate = await updateCandidateById(candidateId, updateData);

    // Remove sensitive data from response
    const { password, api_token, ...candidateData } = updatedCandidate.toJSON();

    // Generate URL for response (optional)
    const resumeUrl = candidateData.resume_key ? generateUrlFromKey(candidateData.resume_key) : null;

    return res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      data: {
        candidate: {
          ...candidateData,
          resume_url: resumeUrl, // Include generated URL for convenience
        },
        upload_info: {
          key: uploadResult.key,
          bucket: uploadResult.bucket,
        },
      },
    });
  } catch (error) {
    logger?.error?.("uploadResumeFile error", {
      error: error.message,
      candidateId: req.candidate?.candidate_id,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to upload resume",
      error: error.message,
    });
  }
}

module.exports = {
  updateCandidateProfile,
  generateResume,
  uploadResumeFile,
};
