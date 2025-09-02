'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('candidates', 'summary', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Professional summary or bio of the candidate',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('candidates', 'summary');
  }
};
