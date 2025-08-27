const { JobCategory, Country } = require("./index");

module.exports = (sequelize, DataTypes) => {
  const Candidate = sequelize.define(
    "Candidate",
    {
      candidate_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      full_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      country_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: Country,
          key: "country_id",
        },
      },
      seniority_level: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      api_token: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      expiry_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      image_url: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      resume_key: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      skills: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      work_experience: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      education: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      payment_gateway: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      subscription_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      qty: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      job_category_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: JobCategory,
          key: "job_category_id",
        },
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
      tableName: "candidates",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    }
  );

  Candidate.associate = (models) => {
    Candidate.belongsTo(models.JobCategory, {
      foreignKey: "job_category_id",
      as: "job_category",
    });
    Candidate.belongsTo(models.Country, {
      foreignKey: "country_id",
      as: "country",
    });
  };

  return Candidate;
};
