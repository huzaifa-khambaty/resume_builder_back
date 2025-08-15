"use strict";
require("dotenv").config(); // load environment variables
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const adminUserId = uuidv4();
    const saltRounds = +process.env.BCRYPT_SALT_ROUNDS;

    await queryInterface.bulkInsert(
      "users",
      [
        {
          user_id: adminUserId,
          email: "admin@gmail.com",
          password: bcrypt.hashSync("12345678", saltRounds), // Should be pre-hashed
          full_name: "Admin User",
          is_active: true,
          api_token: null,
          created_by: adminUserId, // Self-created
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("users", null, {});
  },
};
