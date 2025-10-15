'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('subscription_plans', 'stripe_price_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Stripe Price ID for this subscription plan'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('subscription_plans', 'stripe_price_id');
  }
};
