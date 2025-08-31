'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('countries', {
      country_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      country: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      country_code: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex('countries', ['country'], {
      unique: true,
      name: 'countries_country_unique',
    });
    
    await queryInterface.addIndex('countries', ['country_code'], {
      unique: true,
      name: 'countries_country_code_unique',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('countries');
  }
};
