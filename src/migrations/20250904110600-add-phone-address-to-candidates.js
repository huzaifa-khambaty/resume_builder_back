'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('candidates', 'phone_no', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'full_name',
    });

    await queryInterface.addColumn('candidates', 'address', {
      type: Sequelize.TEXT,
      allowNull: true,
      after: 'phone_no',
    });
    

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('candidates', 'address');
    await queryInterface.removeColumn('candidates', 'phone_no');
  }
};
