"use strict";
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get employer and job category IDs to reference
    const employers = await queryInterface.sequelize.query(
      'SELECT employer_id FROM employers LIMIT 5',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const jobCategories = await queryInterface.sequelize.query(
      'SELECT job_category_id, job_category FROM job_categories LIMIT 10',
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Get admin user ID for created_by
    const adminUser = await queryInterface.sequelize.query(
      'SELECT user_id FROM users WHERE email = \'admin@gmail.com\' LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const adminUserId = adminUser[0]?.user_id;
    const now = new Date();

    // Find specific job categories
    const softwareEngCategory = jobCategories.find(jc => jc.job_category === 'Software Engineer');
    const dataAnalystCategory = jobCategories.find(jc => jc.job_category === 'Data Analyst');
    const productManagerCategory = jobCategories.find(jc => jc.job_category === 'Product Manager');
    const uxDesignerCategory = jobCategories.find(jc => jc.job_category === 'UX/UI Designer');
    const devOpsCategory = jobCategories.find(jc => jc.job_category === 'DevOps Engineer');

    await queryInterface.bulkInsert(
      "jobs",
      [
        {
          job_id: uuidv4(),
          employer_id: employers[0]?.employer_id,
          job_category_id: softwareEngCategory?.job_category_id || jobCategories[0]?.job_category_id,
          job_title: "Senior Full Stack Developer",
          job_description: "We are looking for an experienced Full Stack Developer to join our growing team. You will be responsible for developing and maintaining web applications using modern technologies like React, Node.js, and PostgreSQL. The ideal candidate should have 5+ years of experience in software development.",
          no_of_vacancies: 2,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          job_id: uuidv4(),
          employer_id: employers[1]?.employer_id,
          job_category_id: dataAnalystCategory?.job_category_id || jobCategories[1]?.job_category_id,
          job_title: "Data Scientist",
          job_description: "Join our AI team as a Data Scientist! You'll work on machine learning models, analyze large datasets, and provide insights to drive business decisions. Experience with Python, TensorFlow, and statistical analysis required.",
          no_of_vacancies: 1,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          job_id: uuidv4(),
          employer_id: employers[2]?.employer_id,
          job_category_id: productManagerCategory?.job_category_id || jobCategories[2]?.job_category_id,
          job_title: "Senior Product Manager",
          job_description: "Lead product strategy and roadmap for our fintech products. Work closely with engineering, design, and business teams to deliver innovative financial solutions. 3+ years of product management experience in financial services preferred.",
          no_of_vacancies: 1,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          job_id: uuidv4(),
          employer_id: employers[0]?.employer_id,
          job_category_id: uxDesignerCategory?.job_category_id || jobCategories[3]?.job_category_id,
          job_title: "UX/UI Designer",
          job_description: "Create intuitive and beautiful user experiences for our web and mobile applications. Collaborate with product managers and developers to bring designs to life. Portfolio showcasing web and mobile design work required.",
          no_of_vacancies: 1,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          job_id: uuidv4(),
          employer_id: employers[3]?.employer_id,
          job_category_id: devOpsCategory?.job_category_id || jobCategories[4]?.job_category_id,
          job_title: "DevOps Engineer",
          job_description: "Manage and optimize our cloud infrastructure on AWS. Implement CI/CD pipelines, monitor system performance, and ensure high availability. Experience with Docker, Kubernetes, and infrastructure as code required.",
          no_of_vacancies: 2,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          job_id: uuidv4(),
          employer_id: employers[4]?.employer_id,
          job_category_id: softwareEngCategory?.job_category_id || jobCategories[0]?.job_category_id,
          job_title: "Backend Developer",
          job_description: "Develop and maintain scalable backend services using Node.js and Python. Work with microservices architecture and ensure high performance APIs. Experience with databases and cloud platforms essential.",
          no_of_vacancies: 3,
          created_by: adminUserId,
          updated_by: null,
          created_at: now,
          updated_at: now,
        },
        {
          job_id: uuidv4(),
          employer_id: employers[1]?.employer_id,
          job_category_id: softwareEngCategory?.job_category_id || jobCategories[0]?.job_category_id,
          job_title: "Frontend Developer",
          job_description: "Build responsive and interactive user interfaces using React and modern JavaScript. Collaborate with designers and backend developers to create seamless user experiences. 2+ years of React experience required.",
          no_of_vacancies: 2,
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
    await queryInterface.bulkDelete("jobs", null, {});
  },
};
