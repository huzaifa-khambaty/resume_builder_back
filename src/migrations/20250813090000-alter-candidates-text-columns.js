"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Align with model: use TEXT for potentially long values
    await queryInterface.changeColumn("candidates", "api_token", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn("candidates", "image_url", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.changeColumn("candidates", "resume_url", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to STRING (usually VARCHAR(255)) as in the original migration
    await queryInterface.changeColumn("candidates", "api_token", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("candidates", "image_url", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.changeColumn("candidates", "resume_url", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
};
