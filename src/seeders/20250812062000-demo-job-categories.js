"use strict";
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      "job_categories",
      [
        {
          job_category_id: uuidv4(),
          job_category: "Software Development",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Data Science",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Product Management",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Design",
          created_at: now,
          updated_at: now,
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("job_categories", null, {});
  },
};
