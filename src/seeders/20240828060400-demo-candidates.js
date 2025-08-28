"use strict";
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get some country and job category IDs to reference
    const countries = await queryInterface.sequelize.query(
      'SELECT country_id FROM countries WHERE country_code IN (\'US\', \'CA\', \'GB\') LIMIT 3',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const jobCategories = await queryInterface.sequelize.query(
      'SELECT job_category_id FROM job_categories WHERE job_category IN (\'Software Engineer\', \'Data Analyst\') LIMIT 2',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Get admin user ID for created_by
    const adminUser = await queryInterface.sequelize.query(
      'SELECT user_id FROM users WHERE email = \'admin@gmail.com\' LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const primaryCandidateId = uuidv4();
    const saltRounds = +process.env.BCRYPT_SALT_ROUNDS || 10;
    const adminUserId = adminUser[0]?.user_id;

    await queryInterface.bulkInsert(
      "candidates",
      [
        {
          candidate_id: primaryCandidateId,
          email: "alice.candidate@gmail.com",
          password: bcrypt.hashSync("12345678", saltRounds),
          full_name: "Alice Johnson",
          country_id: countries[0]?.country_id || null,
          seniority_level: "Senior",
          is_active: true,
          api_token: null,
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
          image_url: null,
          resume_key: "resumes/alice-johnson-resume.pdf",
          skills: JSON.stringify([
            "JavaScript", "Node.js", "React", "PostgreSQL", "AWS", "Docker"
          ]),
          work_experience: JSON.stringify([
            {
              job_title: "Senior Software Developer",
              company_name: "Acme Corp",
              location: "San Francisco, CA",
              start_date: "2021-01-01",
              end_date: "2023-12-01",
              description: "Built and maintained Node.js services and REST APIs. Led a team of 3 developers."
            },
            {
              job_title: "Software Developer",
              company_name: "StartupXYZ",
              location: "San Francisco, CA", 
              start_date: "2019-06-01",
              end_date: "2020-12-01",
              description: "Developed React frontend applications and integrated with backend APIs."
            }
          ]),
          education: JSON.stringify([
            {
              degree: "B.Sc. Computer Science",
              institution_name: "Stanford University",
              location: "Stanford, CA",
              start_date: "2015-09-01",
              end_date: "2019-06-01",
              description: "Focused on software engineering and databases. GPA: 3.8/4.0"
            }
          ]),
          payment_gateway: "stripe",
          subscription_id: "sub_1234567890",
          qty: 1,
          unit_price: 29.99,
          job_category_id: jobCategories[0]?.job_category_id || null,
          created_by: adminUserId || primaryCandidateId,
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          candidate_id: uuidv4(),
          email: "bob.candidate@gmail.com",
          password: bcrypt.hashSync("12345678", saltRounds),
          full_name: "Bob Smith",
          country_id: countries[1]?.country_id || null,
          seniority_level: "Mid-level",
          is_active: true,
          api_token: null,
          expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months from now
          image_url: null,
          resume_key: "resumes/bob-smith-resume.pdf",
          skills: JSON.stringify([
            "Python", "Django", "PostgreSQL", "Redis", "Celery", "Docker"
          ]),
          work_experience: JSON.stringify([
            {
              job_title: "Backend Engineer",
              company_name: "Globex Corporation",
              location: "Toronto, ON",
              start_date: "2020-03-01",
              end_date: "2024-01-01",
              description: "Designed and optimized scalable Django services and SQL schemas. Improved API performance by 40%."
            }
          ]),
          education: JSON.stringify([
            {
              degree: "M.Sc. Software Engineering",
              institution_name: "University of Toronto",
              location: "Toronto, ON",
              start_date: "2018-09-01",
              end_date: "2020-06-01",
              description: "Specialized in distributed systems and backend architectures."
            }
          ]),
          payment_gateway: "paypal",
          subscription_id: "I-ABCDEFGHIJKL",
          qty: 1,
          unit_price: 19.99,
          job_category_id: jobCategories[1]?.job_category_id || null,
          created_by: adminUserId || primaryCandidateId,
          updated_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          candidate_id: uuidv4(),
          email: "charlie.dev@gmail.com",
          password: bcrypt.hashSync("12345678", saltRounds),
          full_name: "Charlie Brown",
          country_id: countries[2]?.country_id || null,
          seniority_level: "Junior",
          is_active: true,
          api_token: null,
          expiry_date: null,
          image_url: null,
          resume_key: null,
          skills: JSON.stringify([
            "JavaScript", "Vue.js", "HTML", "CSS", "Git"
          ]),
          work_experience: JSON.stringify([
            {
              job_title: "Junior Frontend Developer",
              company_name: "WebDev Agency",
              location: "London, UK",
              start_date: "2023-01-01",
              end_date: null,
              description: "Building responsive web applications using Vue.js and modern CSS frameworks."
            }
          ]),
          education: JSON.stringify([
            {
              degree: "B.Sc. Web Development",
              institution_name: "University of London",
              location: "London, UK",
              start_date: "2019-09-01",
              end_date: "2022-06-01",
              description: "Comprehensive web development program covering frontend and backend technologies."
            }
          ]),
          payment_gateway: null,
          subscription_id: null,
          qty: 1,
          unit_price: 0.00,
          job_category_id: jobCategories[0]?.job_category_id || null,
          created_by: adminUserId || primaryCandidateId,
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
