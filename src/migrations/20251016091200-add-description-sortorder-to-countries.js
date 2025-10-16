'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('countries', 'description', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('countries', 'sort_order', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });

    // Optional index to speed up sorting
    await queryInterface.addIndex('countries', ['sort_order'], {
      name: 'countries_sort_order_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('countries', 'countries_sort_order_idx');
    await queryInterface.removeColumn('countries', 'sort_order');
    await queryInterface.removeColumn('countries', 'description');
  },
};
