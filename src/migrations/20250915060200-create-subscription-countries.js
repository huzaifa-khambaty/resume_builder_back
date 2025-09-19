"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("subscription_countries", {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      subscription_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "candidate_subscriptions",
          key: "subscription_id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      country_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "countries",
          key: "country_id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
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

    // Add unique constraint to prevent duplicate country selections per subscription
    await queryInterface.addConstraint("subscription_countries", {
      fields: ["subscription_id", "country_id"],
      type: "unique",
      name: "unique_subscription_country",
    });

    // Add indexes for better performance
    await queryInterface.addIndex("subscription_countries", [
      "subscription_id",
    ]);
    await queryInterface.addIndex("subscription_countries", ["country_id"]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("subscription_countries");
  },
};
