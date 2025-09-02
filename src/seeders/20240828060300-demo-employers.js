"use strict";
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get some country IDs to reference
    const countries = await queryInterface.sequelize.query(
      'SELECT country_id FROM countries WHERE country_code IN (\'US\', \'CA\', \'GB\', \'DE\', \'IN\') LIMIT 5',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Get admin user ID for created_by
    const adminUser = await queryInterface.sequelize.query(
      'SELECT user_id FROM users WHERE email = \'admin@gmail.com\' LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const adminUserId = adminUser[0]?.user_id;
    const now = new Date();

    await queryInterface.bulkInsert(
      "employers",
      [
        {
          employer_id: uuidv4(),
          email: "hr@techcorp.com",
          password: null,
          employer_name: "TechCorp Solutions",
          country_id: countries[0]?.country_id || null,
          website: "https://techcorp.com",
          sector: "Technology",
          city: "San Francisco",
          notes: "Leading software development company",
          confidence: 95.50,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          employer_id: uuidv4(),
          email: "careers@innovatetech.com",
          password: null,
          employer_name: "InnovateTech Inc",
          country_id: countries[1]?.country_id || null,
          website: "https://innovatetech.com",
          sector: "Software",
          city: "Toronto",
          notes: "Startup focused on AI and machine learning",
          confidence: 88.75,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          employer_id: uuidv4(),
          email: "jobs@globalfinance.com",
          password: null,
          employer_name: "Global Finance Ltd",
          country_id: countries[2]?.country_id || null,
          website: "https://globalfinance.com",
          sector: "Finance",
          city: "London",
          notes: "International financial services company",
          confidence: 92.30,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          employer_id: uuidv4(),
          email: "recruiting@dataanalytics.de",
          password: null,
          employer_name: "Data Analytics GmbH",
          country_id: countries[3]?.country_id || null,
          website: "https://dataanalytics.de",
          sector: "Data Science",
          city: "Berlin",
          notes: "Specialized in big data and analytics solutions",
          confidence: 89.60,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          employer_id: uuidv4(),
          email: null,
          password: null,
          employer_name: "Digital Solutions Pvt Ltd",
          country_id: countries[4]?.country_id || null,
          website: "https://digitalsolutions.in",
          sector: "IT Services",
          city: "Bangalore",
          notes: "Outsourcing and digital transformation services",
          confidence: 85.20,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
      ],
      {}
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("employers", null, {});
  },
};
