"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove legacy Braintree columns and index
    // Index may not be named; remove by fields
    try {
      await queryInterface.removeIndex("candidate_subscriptions", ["braintree_subscription_id"]);
    } catch {}
    try {
      await queryInterface.removeColumn("candidate_subscriptions", "braintree_subscription_id");
    } catch {}
    try {
      await queryInterface.removeColumn("candidate_subscriptions", "braintree_transaction_id");
    } catch {}

    await queryInterface.addColumn("candidate_subscriptions", "stripe_customer_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("candidate_subscriptions", "stripe_subscription_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("candidate_subscriptions", "stripe_payment_intent_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("candidate_subscriptions", "stripe_price_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("candidate_subscriptions", "stripe_latest_invoice_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex("candidate_subscriptions", ["stripe_subscription_id"], {
      name: "idx_candidate_subscriptions_stripe_subscription_id",
    });
    await queryInterface.addIndex("candidate_subscriptions", ["stripe_payment_intent_id"], {
      name: "idx_candidate_subscriptions_stripe_payment_intent_id",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      "candidate_subscriptions",
      "idx_candidate_subscriptions_stripe_subscription_id"
    );
    await queryInterface.removeIndex(
      "candidate_subscriptions",
      "idx_candidate_subscriptions_stripe_payment_intent_id"
    );

    await queryInterface.removeColumn("candidate_subscriptions", "stripe_customer_id");
    await queryInterface.removeColumn("candidate_subscriptions", "stripe_subscription_id");
    await queryInterface.removeColumn("candidate_subscriptions", "stripe_payment_intent_id");
    await queryInterface.removeColumn("candidate_subscriptions", "stripe_price_id");
    await queryInterface.removeColumn("candidate_subscriptions", "stripe_latest_invoice_id");

    // Re-add Braintree columns and index on rollback
    await queryInterface.addColumn("candidate_subscriptions", "braintree_subscription_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn("candidate_subscriptions", "braintree_transaction_id", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addIndex("candidate_subscriptions", ["braintree_subscription_id"]);
  },
};
