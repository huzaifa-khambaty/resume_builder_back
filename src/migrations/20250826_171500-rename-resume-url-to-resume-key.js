"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if resume_key column already exists
    const tableDescription = await queryInterface.describeTable("candidates");

    // First, add the new resume_key column if it doesn't exist
    if (!tableDescription.resume_key) {
      await queryInterface.addColumn("candidates", "resume_key", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }

    // Migrate existing data: extract S3 keys from URLs
    const candidates = await queryInterface.sequelize.query(
      `SELECT candidate_id, resume_url FROM candidates WHERE resume_url IS NOT NULL`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const candidate of candidates) {
      if (candidate.resume_url) {
        // Extract key from URL patterns
        let key = null;
        const url = candidate.resume_url;

        // Pattern 1: https://bucket.s3.region.amazonaws.com/key
        const pattern1 = /https:\/\/[^\/]+\.s3\.[^\/]+\.amazonaws\.com\/(.+)/;
        // Pattern 2: https://s3.region.amazonaws.com/bucket/key
        const pattern2 = /https:\/\/s3\.[^\/]+\.amazonaws\.com\/[^\/]+\/(.+)/;

        const match1 = url.match(pattern1);
        const match2 = url.match(pattern2);

        if (match1) {
          key = decodeURIComponent(match1[1]);
        } else if (match2) {
          key = decodeURIComponent(match2[1]);
        }

        if (key) {
          await queryInterface.sequelize.query(
            `UPDATE candidates SET resume_key = :key WHERE candidate_id = :id`,
            {
              replacements: { key, id: candidate.candidate_id },
              type: Sequelize.QueryTypes.UPDATE,
            }
          );
        }
      }
    }

    // Remove the old resume_url column if it exists
    if (tableDescription.resume_url) {
      await queryInterface.removeColumn("candidates", "resume_url");
    }
  },

  async down(queryInterface, Sequelize) {
    // Add back the resume_url column
    await queryInterface.addColumn("candidates", "resume_url", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // Migrate data back: generate URLs from keys
    const candidates = await queryInterface.sequelize.query(
      `SELECT candidate_id, resume_key FROM candidates WHERE resume_key IS NOT NULL`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const candidate of candidates) {
      if (candidate.resume_key) {
        // Generate URL from key (using environment variables would be ideal, but not available in migration)
        // This is a basic reconstruction - adjust bucket name and region as needed
        const bucketName = "nextmatch-s3"; // Should match your S3_BUCKET
        const region = "eu-north-1"; // Should match your AWS_REGION
        const url = `https://${bucketName}.s3.${region}.amazonaws.com/${candidate.resume_key}`;

        await queryInterface.sequelize.query(
          `UPDATE candidates SET resume_url = :url WHERE candidate_id = :id`,
          {
            replacements: { url, id: candidate.candidate_id },
            type: Sequelize.QueryTypes.UPDATE,
          }
        );
      }
    }

    // Remove the resume_key column
    await queryInterface.removeColumn("candidates", "resume_key");
  },
};
