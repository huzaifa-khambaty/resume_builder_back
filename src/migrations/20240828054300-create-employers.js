'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('employers', {
      employer_id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      employer_name: {
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
      website: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      sector: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      confidence: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
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
    await queryInterface.addIndex('employers', ['email'], {
      unique: true,
      name: 'employers_email_unique',
      where: {
        email: {
          [Sequelize.Op.ne]: null
        }
      }
    });
    
    await queryInterface.addIndex('employers', ['country_id'], {
      name: 'employers_country_id_idx',
    });
    
    await queryInterface.addIndex('employers', ['employer_name'], {
      name: 'employers_employer_name_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('employers');
  }
};
