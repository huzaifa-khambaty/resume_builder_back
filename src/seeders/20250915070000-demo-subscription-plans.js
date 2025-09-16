"use strict";

const { v4: uuidv4 } = require("uuid");

module.exports = {
  async up(queryInterface, Sequelize) {
    // First, get a user ID to use as created_by (using the first user from the existing users table)
    const [users] = await queryInterface.sequelize.query(
      "SELECT user_id FROM users LIMIT 1"
    );

    const createdBy = users.length > 0 ? users[0].user_id : uuidv4(); // Fallback to a new UUID if no users exist

    await queryInterface.bulkInsert("subscription_plans", [
      {
        plan_id: uuidv4(),
        name: "Basic Plan",
        description:
          "Perfect for individual job seekers looking to access job opportunities in multiple countries.",
        duration_days: 30,
        price_per_country: 9.99,
        is_active: true,
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        plan_id: uuidv4(),
        name: "Professional Plan",
        description:
          "Ideal for experienced professionals seeking opportunities across various global markets.",
        duration_days: 90,
        price_per_country: 19.99,
        is_active: true,
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        plan_id: uuidv4(),
        name: "Premium Plan",
        description:
          "Best value for serious job seekers who want long-term access to international opportunities.",
        duration_days: 180,
        price_per_country: 29.99,
        is_active: true,
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        plan_id: uuidv4(),
        name: "Enterprise Plan",
        description:
          "Comprehensive solution for executive-level professionals and long-term career planning.",
        duration_days: 365,
        price_per_country: 49.99,
        is_active: true,
        created_by: createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("subscription_plans", null, {});
  },
};
