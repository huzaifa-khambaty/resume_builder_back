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
          job_category: "Software Engineer",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "DevOps Engineer",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Data Analyst",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Cybersecurity Analyst",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Product Manager",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "QA Engineer",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Project Manager",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "UX/UI Designer",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Digital Marketing Specialist",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Account Executive (Sales)",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Customer Support Specialist",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Accountant",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "HR Generalist",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Supply Chain Analyst",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Business Analyst",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Civil Engineer",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Electrical Engineer",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Mechanical Engineer",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Registered Nurse",
          created_at: now,
          updated_at: now,
        },
        {
          job_category_id: uuidv4(),
          job_category: "Teacher / Instructor",
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
