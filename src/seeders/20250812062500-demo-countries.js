"use strict";
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();
    await queryInterface.bulkInsert(
      "countries",
      [
        {
          country_id: uuidv4(),
          country: "United States",
          country_code: "US",
          created_at: now,
          updated_at: now,
        },
        {
          country_id: uuidv4(),
          country: "United Kingdom",
          country_code: "UK",
          created_at: now,
          updated_at: now,
        },
        {
          country_id: uuidv4(),
          country: "Canada",
          country_code: "CA",
          created_at: now,
          updated_at: now,
        },
        {
          country_id: uuidv4(),
          country: "Pakistan",
          country_code: "PK",
          created_at: now,
          updated_at: now,
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("countries", null, {});
  },
};
