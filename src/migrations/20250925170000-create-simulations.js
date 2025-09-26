"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("simulations", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      candidate_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "candidates", key: "candidate_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      country_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "countries", key: "country_id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      job_category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "job_categories", key: "job_category_id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      no_of_jobs: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      short_listed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });
    await queryInterface.addIndex("simulations", ["candidate_id", "country_id", "job_category_id"], {
      name: "idx_sim_candidate_country_category",
      unique: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("simulations");
  },
};
