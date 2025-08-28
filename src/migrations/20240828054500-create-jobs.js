'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('jobs', {
      job_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      employer_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'employers',
          key: 'employer_id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      job_category_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'job_categories',
          key: 'job_category_id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      job_title: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      job_description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      no_of_vacancies: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Add indexes
    await queryInterface.addIndex('jobs', ['employer_id'], {
      name: 'jobs_employer_id_idx',
    });
    
    await queryInterface.addIndex('jobs', ['job_category_id'], {
      name: 'jobs_job_category_id_idx',
    });
    
    await queryInterface.addIndex('jobs', ['job_title'], {
      name: 'jobs_job_title_idx',
    });

    // Add unique composite index as defined in the model
    await queryInterface.addIndex('jobs', ['employer_id', 'job_category_id', 'job_title'], {
      unique: true,
      name: 'unique_employer_job_category_title',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('jobs');
  }
};
