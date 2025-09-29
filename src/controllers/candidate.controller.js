const {
  validateCandidateProfileUpdate,
  validateGenerateResumePayload,
  validateResumeUpload,
  validateResumeEdit,
  validateResumeDownload,
} = require("../validations/candidate.validation");
const {
  updateCandidateById,
  generateResumeFromProfile,
  getJobListForCandidate,
} = require("../services/candidate.service");
const {
  getCandidateDashboard: getCandidateDashboardService,
} = require("../services/dashboard.service");
const {
  getChartsByJobCategoryDatewise: getChartsByJobCategoryDatewiseService,
} = require("../services/dashboard.service");
const {
  getEmployersByCountryAndCategory,
} = require("../services/employer.service");
const {
  validateEmployerScrapInput,
} = require("../validations/employer.validation");
const {
  uploadResume,
  extractKeyFromUrl,
  deleteFile,
  generateUrlFromKey,
  getSignedUrl,
  fileExists,
} = require("../services/s3.service");
const logger = require("../config/logger");
const { getValidationErrorMessage } = require("../utils/errorHelper");

async function updateCandidateProfile(req, res) {
  try {
    const { valid, errors, cleaned } = validateCandidateProfileUpdate(
      req.body || {}
    );
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: getValidationErrorMessage(errors) });
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
        .json({ success: false, message: getValidationErrorMessage(errors) });
    }

    // Persist any updated profile fields before generating the resume
    try {
      const candidateId = req.candidate.candidate_id;
      await updateCandidateById(candidateId, {
        full_name: cleaned.candidate_name, // map candidate_name -> full_name
        phone_no: cleaned.phone_no,
        address: cleaned.address,
        seniority_level: cleaned.seniority_level,
        job_category_id: cleaned.job_category_id,
        country_id: cleaned.country_id,
        updated_by: candidateId,
      });
    } catch (persistError) {
      // Log and continue; generation should not be blocked by persistence errors
      logger?.warn?.("generateResume: failed to persist profile fields", {
        error: persistError.message,
        candidateId: req.candidate?.candidate_id,
      });
    }

    const data = await generateResumeFromProfile({
      ...cleaned,
      // ensure email and seniority_level are available to the service/prompt
      email: req?.candidate?.email || cleaned.email,
      phone_no: req?.candidate?.phone_no || cleaned.phone_no,
      address: req?.candidate?.address || cleaned.address,
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

    // Parse education if provided
    if (parsedBody.education && typeof parsedBody.education === "string") {
      try {
        parsedBody.education = JSON.parse(parsedBody.education);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid education format. Must be valid JSON array.",
        });
      }
    }

    // Summary doesn't need parsing as it's already a string

    // Validate additional data (skills, work_experience, summary, etc.)
    const { valid, errors, cleaned } = validateResumeUpload(parsedBody);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: getValidationErrorMessage(errors),
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
        logger?.info?.("Old resume deleted from S3", {
          candidateId,
          oldKey: currentCandidate.resume_key,
        });
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
      full_name: cleaned.full_name,
      phone_no: cleaned.phone_no,
      address: cleaned.address,
      seniority_level: cleaned.seniority_level,
      job_category_id: cleaned.job_category_id,
      country_id: cleaned.country_id,
      education: cleaned.education,
      skills: cleaned.skills,
      work_experience: cleaned.work_experience,
      summary: cleaned.summary,
      updated_by: candidateId,
    };

    const updatedCandidate = await updateCandidateById(candidateId, updateData);

    // Remove sensitive data from response
    const { password, api_token, ...candidateData } = updatedCandidate.toJSON();

    // Generate URL for response (optional)
    const resumeUrl = candidateData.resume_key
      ? generateUrlFromKey(candidateData.resume_key)
      : null;

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

// PUT /api/candidate/resume/edit
async function editResumeFile(req, res) {
  try {
    const candidateId = req.candidate.candidate_id;

    // Get current candidate to check for existing resume
    const currentCandidate =
      await require("../services/candidate.service").findCandidateById(
        candidateId
      );

    if (!currentCandidate?.resume_key) {
      return res.status(404).json({
        success: false,
        message: "No resume found to edit. Please upload a resume first.",
      });
    }

    // Check if new file is uploaded
    let uploadResult = null;
    if (req.file) {
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

      // Delete old resume from S3
      try {
        await deleteFile(currentCandidate.resume_key);
        logger?.info?.("Old resume deleted from S3", {
          candidateId,
          oldKey: currentCandidate.resume_key,
        });
      } catch (deleteError) {
        logger?.warn?.("Failed to delete old resume", {
          candidateId,
          error: deleteError.message,
        });
        // Continue with upload even if old file deletion fails
      }

      // Upload new resume to S3
      uploadResult = await uploadResume(
        req.file.buffer,
        req.file.originalname,
        candidateId
      );

      if (!uploadResult.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload new resume to cloud storage",
        });
      }
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

    // Parse education if provided
    if (parsedBody.education && typeof parsedBody.education === "string") {
      try {
        parsedBody.education = JSON.parse(parsedBody.education);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid education format. Must be valid JSON array.",
        });
      }
    }

    // Summary doesn't need parsing as it's already a string

    // Validate resume edit data
    const { valid, errors, cleaned } = validateResumeEdit(parsedBody);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: getValidationErrorMessage(errors),
      });
    }

    // Prepare update data
    const updateData = {
      ...cleaned,
      updated_by: candidateId,
    };

    // Add new resume key if file was uploaded
    if (uploadResult) {
      updateData.resume_key = uploadResult.key;
    }

    // Update candidate with new data
    const updatedCandidate = await updateCandidateById(candidateId, updateData);

    // Remove sensitive data from response
    const { password, api_token, ...candidateData } = updatedCandidate.toJSON();

    // Generate URL for response (optional)
    const resumeUrl = candidateData.resume_key
      ? generateUrlFromKey(candidateData.resume_key)
      : null;

    return res.status(200).json({
      success: true,
      message: "Resume updated successfully",
      data: {
        candidate: {
          ...candidateData,
          resume_url: resumeUrl,
        },
        upload_info: uploadResult
          ? {
              key: uploadResult.key,
              bucket: uploadResult.bucket,
            }
          : null,
      },
    });
  } catch (error) {
    logger?.error?.("editResumeFile error", {
      error: error.message,
      candidateId: req.candidate?.candidate_id,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update resume",
      error: error.message,
    });
  }
}

// GET /api/candidate/resume/download?key=resume_key
async function downloadResumeFile(req, res) {
  try {
    const { key } = req.query;
    const candidateId = req.candidate.candidate_id;

    // Validate the key parameter
    const { valid, errors } = validateResumeDownload({ key });
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: getValidationErrorMessage(errors),
      });
    }

    // Check if the file exists in S3
    const exists = await fileExists(key);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Resume file not found",
      });
    }

    // Verify that the key belongs to the authenticated candidate
    // Extract candidate ID from the key path (resumes/{candidateId}/filename)
    const keyParts = key.split("/");
    if (keyParts.length >= 2 && keyParts[0] === "resumes") {
      const keyCandidateId = keyParts[1];
      if (keyCandidateId !== candidateId) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. You can only download your own resume files.",
        });
      }
    } else {
      // If key doesn't follow expected pattern, deny access for security
      return res.status(403).json({
        success: false,
        message: "Invalid resume key format",
      });
    }

    // Generate signed URL for secure download (expires in 1 hour)
    const signedUrl = await getSignedUrl(key, 3600);

    logger?.info?.("Resume download URL generated", {
      candidateId,
      key,
      expiresIn: 3600,
    });

    return res.status(200).json({
      success: true,
      message: "Resume download URL generated successfully",
      data: {
        download_url: signedUrl,
        key: key,
        expires_in: 3600, // 1 hour in seconds
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      },
    });
  } catch (error) {
    logger?.error?.("downloadResumeFile error", {
      error: error.message,
      candidateId: req.candidate?.candidate_id,
      key: req.query?.key,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to generate resume download URL",
      error: error.message,
    });
  }
}

// GET /api/candidate/resume/download (download current user's resume)
async function downloadCurrentResume(req, res) {
  try {
    const candidateId = req.candidate.candidate_id;

    // Get current candidate to check for existing resume
    const currentCandidate =
      await require("../services/candidate.service").findCandidateById(
        candidateId
      );

    if (!currentCandidate?.resume_key) {
      return res.status(404).json({
        success: false,
        message: "No resume found. Please upload a resume first.",
      });
    }

    // Check if the file exists in S3
    const exists = await fileExists(currentCandidate.resume_key);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Resume file not found in storage",
      });
    }

    // Generate signed URL for secure download (expires in 1 hour)
    const signedUrl = await getSignedUrl(currentCandidate.resume_key, 3600);

    logger?.info?.("Current resume download URL generated", {
      candidateId,
      key: currentCandidate.resume_key,
      expiresIn: 3600,
    });

    return res.status(200).json({
      success: true,
      message: "Resume download URL generated successfully",
      data: {
        download_url: signedUrl,
        key: currentCandidate.resume_key,
        expires_in: 3600, // 1 hour in seconds
        expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      },
    });
  } catch (error) {
    logger?.error?.("downloadCurrentResume error", {
      error: error.message,
      candidateId: req.candidate?.candidate_id,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to generate resume download URL",
    });
  }
}

// GET /api/candidate/employers?country_id=&job_category_id=
async function getEmployersForCandidate(req, res) {
  try {
    // Accept from query primarily
    const merged = { ...(req.query || {}), ...(req.body || {}) };

    // Explicit required checks for professional messages
    const missing = [];
    if (!merged.country_id) missing.push("country_id");
    if (!merged.job_category_id) missing.push("job_category_id");
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          missing.length === 1
            ? `${missing[0]} is required`
            : `${missing.join(", ")} are required`,
      });
    }

    const { valid, errors, cleaned } = validateEmployerScrapInput(merged);
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: getValidationErrorMessage(errors) });
    }

    const { country_id, job_category_id } = cleaned;
    const result = await getEmployersByCountryAndCategory(
      country_id,
      job_category_id
    );

    const items = Array.isArray(result?.employers)
      ? result.employers.map((e) => ({
          employer_id: e.employer_id,
          employer_name: e.employer_name,
          city: e.city || null,
        }))
      : [];

    return res.status(200).json({
      success: true,
      message: "Employers fetched successfully",
      data: items,
    });
  } catch (error) {
    logger?.error?.("getEmployersForCandidate error", { error });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch employers",
    });
  }
}

// GET /api/candidate/dashboard
async function getCandidateDashboard(req, res) {
  try {
    const candidateId = req.candidate.candidate_id;
    const agg = await getCandidateDashboardService(candidateId);

    // Transform to requested response shape
    const candidate = agg.candidate || {};
    const subscription = agg.subscription || null;
    const sims = agg.simulations || { items: [] };

    const response = {
      data: {
        candidate: {
          id: candidate.candidate_id,
          fullName: candidate.full_name,
          email: candidate.email,
          country: candidate.country
            ? {
                id: candidate.country.country_id,
                name: candidate.country.country,
                code: candidate.country.country_code,
              }
            : null,
          jobCategory: candidate.job_category
            ? {
                id: candidate.job_category.job_category_id,
                name: candidate.job_category.job_category,
              }
            : null,
          seniorityLevel: candidate.seniority_level || null,
          resumeUrl: agg?.resume?.download_url || null,
        },
        subscription: subscription
          ? {
              id: subscription.subscription_id,
              status: subscription.status,
              startDate: subscription.start_date,
              endDate: subscription.end_date,
              remainingDays: subscription.remaining_days,
              countryCount: subscription.country_count,
              totalAmount: Number(subscription.total_amount || 0),
              subscribedCountries: (subscription.countries || []).map((c) => ({
                id: c.country_id,
                name: c.country,
              })),
            }
          : null,
        statistics: (() => {
          const items = Array.isArray(sims.items) ? sims.items : [];
          const totalAppliedCountries = new Set(items.map((i) => i.country_id))
            .size;
          const totalJobsApplied = items.reduce(
            (sum, i) => sum + Number(i.no_of_jobs || 0),
            0
          );
          const totalJobsShortlisted = items.reduce(
            (sum, i) => sum + Number(i.short_listed || 0),
            0
          );
          const totalPurchasedCountries = subscription?.country_count || 0;
          return {
            totalPurchasedCountries,
            totalAppliedCountries,
            totalJobsApplied,
            totalJobsShortlisted,
          };
        })(),
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    logger?.error?.("getCandidateDashboard error", {
      error: error.message,
      candidateId: req.candidate?.candidate_id,
    });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch dashboard",
    });
  }
}

// GET /api/candidate/job-list
async function getJobList(req, res) {
  try {
    const candidateId = req.candidate.candidate_id;
    const jobListData = await getJobListForCandidate(candidateId);

    return res.status(200).json({
      success: true,
      message: "Job list retrieved successfully",
      ...jobListData,
    });
  } catch (error) {
    logger?.error?.("getJobList error", {
      error: error.message,
      candidateId: req.candidate?.candidate_id,
    });

    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to retrieve job list",
    });
  }
}

// GET /api/candidate/charts/:job_category_id
async function getChartsByJobCategory(req, res) {
  try {
    const candidateId = req.candidate.candidate_id;
    const jobCategoryId = req.params.job_category_id;
    // Return date-wise chart data on this same route as requested
    const charts = await getChartsByJobCategoryDatewiseService(
      candidateId,
      jobCategoryId
    );
    return res.status(200).json({ success: true, data: charts });
  } catch (error) {
    logger?.error?.("getChartsByJobCategory error", {
      error: error.message,
      candidateId: req.candidate?.candidate_id,
      jobCategoryId: req.params?.job_category_id,
    });
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Failed to fetch charts",
    });
  }
}

module.exports = {
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
};
