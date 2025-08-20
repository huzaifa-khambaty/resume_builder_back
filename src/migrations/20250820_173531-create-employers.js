"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("employers", {
      employer_id: {
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
      employer_name: {
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
      website: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      sector: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      confidence: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
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

    await queryInterface.addIndex("employers", ["email"], {
      unique: true,
      name: "idx_employers_email_unique",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employers");
  },
};
