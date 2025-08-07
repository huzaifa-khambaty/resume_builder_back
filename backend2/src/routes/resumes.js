const express = require('express');
const { query, transaction } = require('../database/connection');
const { validate, schemas } = require('../utils/validation');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate } = require('../middleware/auth');
const AWSService = require('../services/awsService');
const OpenAIService = require('../services/openaiService');
const logger = require('../utils/logger');

const router = express.Router();

// Create a new resume
router.post('/',
  authenticate,
  validate(schemas.resumeData),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { job_title, work_location, work_experiences } = req.body;

    // Generate resume content using OpenAI
    const resumeData = {
      job_title,
      work_location,
      work_experiences,
      user_name: req.user.name
    };

    const generatedResume = await OpenAIService.generateResume(resumeData);

    // Create resume record in database
    const result = await transaction(async (client) => {
      // Insert resume
      const resumeResult = await client.query(`
        INSERT INTO resumes (
          user_id, job_title, work_location, content, word_count,
          quality_score, skill_match_percentage, completeness_score, overall_score,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'generated')
        RETURNING *
      `, [
        userId,
        job_title,
        work_location,
        generatedResume.content,
        generatedResume.word_count,
        generatedResume.quality_score,
        generatedResume.skill_match_percentage,
        generatedResume.completeness_score,
        generatedResume.overall_score
      ]);

      const resume = resumeResult.rows[0];

      // Insert work experiences
      for (const experience of work_experiences) {
        await client.query(`
          INSERT INTO work_experiences (
            resume_id, company_name, job_title, start_date, end_date,
            is_current, description, skills, achievements
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          resume.id,
          experience.company_name,
          experience.job_title,
          experience.start_date,
          experience.end_date || null,
          experience.is_current || false,
          experience.description || null,
          experience.skills || [],
          experience.achievements || []
        ]);
      }

      return resume;
    });

    logger.info(`Resume created: ${result.id} for user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Resume generated successfully',
      data: { resume: result }
    });
  })
);

// Get user's resumes
router.get('/',
  authenticate,
  validate(schemas.pagination, 'query'),
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { page, limit, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE r.user_id = $1';
    const params = [userId];

    if (status) {
      params.push(status);
      whereClause += ` AND r.status = $${params.length}`;
    }

    const [resumesResult, countResult] = await Promise.all([
      query(`
        SELECT r.*, 
               COUNT(we.id) as experience_count,
               array_agg(
                 json_build_object(
                   'company_name', we.company_name,
                   'job_title', we.job_title,
                   'start_date', we.start_date,
                   'end_date', we.end_date,
                   'is_current', we.is_current
                 ) ORDER BY we.start_date DESC
               ) FILTER (WHERE we.id IS NOT NULL) as work_experiences
        FROM resumes r
        LEFT JOIN work_experiences we ON r.id = we.resume_id
        ${whereClause}
        GROUP BY r.id
        ORDER BY r.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `, [...params, limit, offset]),
      
      query(`
        SELECT COUNT(*) as total
        FROM resumes r
        ${whereClause}
      `, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        resumes: resumesResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  })
);

// Get specific resume
router.get('/:resumeId',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const userId = req.user.id;

    const result = await query(`
      SELECT r.*, 
             array_agg(
               json_build_object(
                 'id', we.id,
                 'company_name', we.company_name,
                 'job_title', we.job_title,
                 'start_date', we.start_date,
                 'end_date', we.end_date,
                 'is_current', we.is_current,
                 'description', we.description,
                 'skills', we.skills,
                 'achievements', we.achievements
               ) ORDER BY we.start_date DESC
             ) FILTER (WHERE we.id IS NOT NULL) as work_experiences
      FROM resumes r
      LEFT JOIN work_experiences we ON r.id = we.resume_id
      WHERE r.id = $1 AND r.user_id = $2
      GROUP BY r.id
    `, [resumeId, userId]);

    if (result.rows.length === 0) {
      throw new AppError('Resume not found', 404);
    }

    const resume = result.rows[0];

    res.json({
      success: true,
      data: { resume }
    });
  })
);

// Update resume
router.put('/:resumeId',
  authenticate,
  validate(schemas.uuid, 'params'),
  validate(schemas.resumeData),
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const userId = req.user.id;
    const { job_title, work_location, work_experiences } = req.body;

    // Verify resume ownership
    const resumeCheck = await query(
      'SELECT id FROM resumes WHERE id = $1 AND user_id = $2',
      [resumeId, userId]
    );

    if (resumeCheck.rows.length === 0) {
      throw new AppError('Resume not found', 404);
    }

    // Regenerate resume content
    const resumeData = {
      job_title,
      work_location,
      work_experiences,
      user_name: req.user.name
    };

    const generatedResume = await OpenAIService.generateResume(resumeData);

    const result = await transaction(async (client) => {
      // Update resume
      const resumeResult = await client.query(`
        UPDATE resumes SET
          job_title = $1, work_location = $2, content = $3, word_count = $4,
          quality_score = $5, skill_match_percentage = $6, completeness_score = $7,
          overall_score = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $9 AND user_id = $10
        RETURNING *
      `, [
        job_title,
        work_location,
        generatedResume.content,
        generatedResume.word_count,
        generatedResume.quality_score,
        generatedResume.skill_match_percentage,
        generatedResume.completeness_score,
        generatedResume.overall_score,
        resumeId,
        userId
      ]);

      const resume = resumeResult.rows[0];

      // Delete existing work experiences
      await client.query('DELETE FROM work_experiences WHERE resume_id = $1', [resumeId]);

      // Insert new work experiences
      for (const experience of work_experiences) {
        await client.query(`
          INSERT INTO work_experiences (
            resume_id, company_name, job_title, start_date, end_date,
            is_current, description, skills, achievements
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          resumeId,
          experience.company_name,
          experience.job_title,
          experience.start_date,
          experience.end_date || null,
          experience.is_current || false,
          experience.description || null,
          experience.skills || [],
          experience.achievements || []
        ]);
      }

      return resume;
    });

    logger.info(`Resume updated: ${resumeId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Resume updated successfully',
      data: { resume: result }
    });
  })
);

// Generate signed upload URL for resume PDF
router.post('/:resumeId/upload-url',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const userId = req.user.id;

    // Verify resume ownership
    const resumeCheck = await query(
      'SELECT id FROM resumes WHERE id = $1 AND user_id = $2',
      [resumeId, userId]
    );

    if (resumeCheck.rows.length === 0) {
      throw new AppError('Resume not found', 404);
    }

    // Generate signed upload URL
    const { uploadUrl, downloadUrl, key } = await AWSService.generateSignedUploadUrl(userId, 'pdf');

    // Update resume with S3 information
    await query(`
      UPDATE resumes 
      SET s3_url = $1, s3_key = $2, status = 'uploaded', updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [downloadUrl, key, resumeId]);

    logger.info(`Upload URL generated for resume: ${resumeId}`);

    res.json({
      success: true,
      message: 'Upload URL generated successfully',
      data: {
        uploadUrl,
        downloadUrl,
        key
      }
    });
  })
);

// Get resume download URL
router.get('/:resumeId/download',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const userId = req.user.id;

    const result = await query(
      'SELECT s3_key, s3_url FROM resumes WHERE id = $1 AND user_id = $2',
      [resumeId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Resume not found', 404);
    }

    const resume = result.rows[0];

    if (!resume.s3_key) {
      throw new AppError('Resume PDF not uploaded yet', 400);
    }

    // Generate signed download URL (valid for 1 hour)
    const downloadUrl = await AWSService.generateSignedDownloadUrl(resume.s3_key, 3600);

    res.json({
      success: true,
      data: { downloadUrl }
    });
  })
);

// Delete resume
router.delete('/:resumeId',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const userId = req.user.id;

    const result = await query(
      'SELECT s3_key FROM resumes WHERE id = $1 AND user_id = $2',
      [resumeId, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Resume not found', 404);
    }

    const resume = result.rows[0];

    await transaction(async (client) => {
      // Delete work experiences
      await client.query('DELETE FROM work_experiences WHERE resume_id = $1', [resumeId]);

      // Delete resume
      await client.query('DELETE FROM resumes WHERE id = $1', [resumeId]);
    });

    // Delete from S3 if exists
    if (resume.s3_key) {
      try {
        await AWSService.deleteFromS3(resume.s3_key);
      } catch (error) {
        logger.error('Error deleting resume from S3:', error);
        // Continue with the process even if S3 deletion fails
      }
    }

    logger.info(`Resume deleted: ${resumeId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Resume deleted successfully'
    });
  })
);

// Get resume analytics/statistics
router.get('/:resumeId/analytics',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const userId = req.user.id;

    // Verify resume ownership
    const resumeCheck = await query(
      'SELECT id FROM resumes WHERE id = $1 AND user_id = $2',
      [resumeId, userId]
    );

    if (resumeCheck.rows.length === 0) {
      throw new AppError('Resume not found', 404);
    }

    // Get simulation statistics
    const simulationStats = await query(`
      SELECT 
        COUNT(*) as total_simulations,
        COUNT(DISTINCT country_code) as countries_used,
        SUM(current_opens) as total_opens,
        SUM(current_shortlists) as total_shortlists,
        SUM(total_employers) as total_employers_reached,
        AVG(current_opens::float / NULLIF(total_employers, 0) * 100) as avg_open_rate,
        AVG(current_shortlists::float / NULLIF(current_opens, 0) * 100) as avg_shortlist_rate
      FROM resume_simulations
      WHERE resume_id = $1
    `, [resumeId]);

    // Get recent simulation activity
    const recentActivity = await query(`
      SELECT rs.country_code, c.name as country_name, rs.status,
             rs.current_opens, rs.current_shortlists, rs.total_employers,
             rs.simulation_start, rs.simulation_end, rs.last_updated
      FROM resume_simulations rs
      LEFT JOIN countries c ON rs.country_code = c.code
      WHERE rs.resume_id = $1
      ORDER BY rs.created_at DESC
      LIMIT 10
    `, [resumeId]);

    const analytics = {
      statistics: simulationStats.rows[0],
      recent_activity: recentActivity.rows
    };

    // Convert numeric strings to numbers
    Object.keys(analytics.statistics).forEach(key => {
      const value = analytics.statistics[key];
      if (value !== null && !isNaN(value)) {
        analytics.statistics[key] = parseFloat(value);
      }
    });

    res.json({
      success: true,
      data: { analytics }
    });
  })
);

// Improve resume content based on feedback
router.post('/:resumeId/improve',
  authenticate,
  validate(schemas.uuid, 'params'),
  asyncHandler(async (req, res) => {
    const { resumeId } = req.params;
    const userId = req.user.id;
    const { feedback } = req.body;

    if (!feedback || feedback.trim().length === 0) {
      throw new AppError('Feedback is required', 400);
    }

    // Get current resume
    const resumeResult = await query(
      'SELECT content FROM resumes WHERE id = $1 AND user_id = $2',
      [resumeId, userId]
    );

    if (resumeResult.rows.length === 0) {
      throw new AppError('Resume not found', 404);
    }

    const currentContent = resumeResult.rows[0].content;

    // Generate improved content
    const improvedContent = await OpenAIService.improveResumeContent(currentContent, feedback);

    // Calculate new scores
    const wordCount = improvedContent.split(/\s+/).length;
    const qualityScore = OpenAIService.calculateQualityScore(improvedContent, { work_experiences: [] });

    // Update resume
    await query(`
      UPDATE resumes 
      SET content = $1, word_count = $2, quality_score = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [improvedContent, wordCount, qualityScore, resumeId]);

    logger.info(`Resume improved: ${resumeId} for user ${userId}`);

    res.json({
      success: true,
      message: 'Resume improved successfully',
      data: {
        content: improvedContent,
        word_count: wordCount,
        quality_score: qualityScore
      }
    });
  })
);

module.exports = router;