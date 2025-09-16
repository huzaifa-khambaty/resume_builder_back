"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("candidate_subscriptions", {
      subscription_id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      candidate_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "candidates",
          key: "candidate_id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "subscription_plans",
          key: "plan_id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      braintree_subscription_id: {
        type: Sequelize.STRING,
        allowNull: true, // Will be set after successful payment
      },
      braintree_transaction_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      country_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("pending", "active", "expired", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      payment_status: {
        type: Sequelize.ENUM("pending", "completed", "failed", "refunded"),
        allowNull: false,
        defaultValue: "pending",
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
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes for better performance
    await queryInterface.addIndex("candidate_subscriptions", ["candidate_id"]);
    await queryInterface.addIndex("candidate_subscriptions", ["plan_id"]);
    await queryInterface.addIndex("candidate_subscriptions", ["status"]);
    await queryInterface.addIndex("candidate_subscriptions", [
      "start_date",
      "end_date",
    ]);
    await queryInterface.addIndex("candidate_subscriptions", [
      "braintree_subscription_id",
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("candidate_subscriptions");
  },
};
