"use strict";
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const primaryCandidateId = uuidv4();
    const saltRounds = +process.env.BCRYPT_SALT_ROUNDS;

    await queryInterface.bulkInsert(
      "candidates",
      [
        {
          candidate_id: primaryCandidateId,
          email: "alice.candidate@gmail.com",
          password: bcrypt.hashSync("12345678", saltRounds),
          full_name: "Alice Candidate",
          country_id: null,
          seniority_level: null,
          is_active: true,
          api_token: null,
          expiry_date: null,
          image_url: null,
          resume_url: null,
          skills: JSON.stringify(["JavaScript", "Node.js", "SQL"]),
          work_experience: JSON.stringify([
            {
              job_title: "Software Developer",
              company_name: "Acme Corp",
              location: "San Francisco, CA",
              start_date: "2021-01-01",
              end_date: "2023-01-01",
              description:
                "Built and maintained Node.js services and REST APIs.",
            },
          ]),
          education: JSON.stringify([
            {
              degree: "B.Sc. Computer Science",
              institution_name: "State University",
              location: "San Jose, CA",
              start_date: "2017-09-01",
              end_date: "2021-06-01",
              description: "Focused on software engineering and databases.",
            },
          ]),
          payment_gateway: null,
          subscription_id: null,
          qty: 1,
          unit_price: 0.0,
          job_category_id: null,
          created_by: primaryCandidateId,
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          candidate_id: uuidv4(),
          email: "bob.candidate@gmail.com",
          password: bcrypt.hashSync("12345678", saltRounds),
          full_name: "Bob Candidate",
          country_id: null,
          seniority_level: null,
          is_active: true,
          api_token: null,
          expiry_date: null,
          image_url: null,
          resume_url: null,
          skills: JSON.stringify(["Python", "Django", "PostgreSQL"]),
          work_experience: JSON.stringify([
            {
              job_title: "Backend Engineer",
              company_name: "Globex",
              location: "New York, NY",
              start_date: "2020-03-01",
              end_date: "2023-01-01",
              description:
                "Designed and optimized scalable Django services and SQL schemas.",
            },
          ]),
          education: JSON.stringify([
            {
              degree: "M.Sc. Software Engineering",
              institution_name: "Tech Institute",
              location: "New York, NY",
              start_date: "2018-09-01",
              end_date: "2020-06-01",
              description:
                "Specialized in distributed systems and backend architectures.",
            },
          ]),
          payment_gateway: null,
          subscription_id: null,
          qty: 1,
          unit_price: 0.0,
          job_category_id: null,
          created_by: primaryCandidateId,
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("candidates", null, {});
  },
};
