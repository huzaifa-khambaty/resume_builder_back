"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("candidates", {
      candidate_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      full_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      country_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "countries", key: "country_id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      seniority_level: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      api_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      expiry_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      image_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resume_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      skills: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      work_experience: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      education: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      payment_gateway: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      qty: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      job_category_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "job_categories", key: "job_category_id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
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

    await queryInterface.addIndex("candidates", ["email"], {
      unique: true,
      name: "idx_candidates_email_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("candidates");
  },
};
