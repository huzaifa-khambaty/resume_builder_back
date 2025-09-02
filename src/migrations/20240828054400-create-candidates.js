'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('candidates', {
      candidate_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      full_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      country_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'countries',
          key: 'country_id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      seniority_level: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      api_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      expiry_date: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      image_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resume_key: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      skills: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      work_experience: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      education: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      payment_gateway: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      qty: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      unit_price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      job_category_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'job_categories',
          key: 'job_category_id',
        },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
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
    await queryInterface.addIndex('candidates', ['email'], {
      unique: true,
      name: 'candidates_email_unique',
    });
    
    await queryInterface.addIndex('candidates', ['country_id'], {
      name: 'candidates_country_id_idx',
    });
    
    await queryInterface.addIndex('candidates', ['job_category_id'], {
      name: 'candidates_job_category_id_idx',
    });
    
    await queryInterface.addIndex('candidates', ['is_active'], {
      name: 'candidates_is_active_idx',
    });
    
    await queryInterface.addIndex('candidates', ['expiry_date'], {
      name: 'candidates_expiry_date_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('candidates');
  }
};
