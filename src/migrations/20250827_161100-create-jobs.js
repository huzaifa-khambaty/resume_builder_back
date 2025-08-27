"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("jobs", {
      job_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      employer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "employers", key: "employer_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      job_category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "job_categories", key: "job_category_id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      job_title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      job_description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      no_of_vacancies: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
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

    // Add unique constraint for employer_id + job_category_id + job_title
    await queryInterface.addIndex(
      "jobs",
      ["employer_id", "job_category_id", "job_title"],
      {
        unique: true,
        name: "unique_employer_job_category_title",
      }
    );

    // Add individual indexes for better query performance
    await queryInterface.addIndex("jobs", ["employer_id"], {
      name: "idx_jobs_employer_id",
    });

    await queryInterface.addIndex("jobs", ["job_category_id"], {
      name: "idx_jobs_job_category_id",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("jobs");
  },
};
