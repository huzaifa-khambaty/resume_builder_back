"use strict";

/**
 * Align employers.email with model change (allowNull: true)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn("employers", "email", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Revert to NOT NULL (may fail if existing rows have NULL emails)
    await queryInterface.changeColumn("employers", "email", {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },
};
