module.exports = (sequelize, DataTypes) => {
  const Job = sequelize.define(
    "Job",
    {
      job_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      employer_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "employers",
          key: "employer_id",
        },
      },
      job_category_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "job_categories",
          key: "job_category_id",
        },
      },
      job_title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      job_description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      no_of_vacancies: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      created_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      updated_by: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "jobs",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["employer_id", "job_category_id", "job_title"],
          name: "unique_employer_job_category_title",
        },
      ],
    }
  );

  Job.associate = (models) => {
    Job.belongsTo(models.Employer, {
      foreignKey: "employer_id",
      as: "employer",
    });
    Job.belongsTo(models.JobCategory, {
      foreignKey: "job_category_id",
      as: "jobCategory",
    });
  };

  return Job;
};
