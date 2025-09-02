module.exports = (sequelize, DataTypes) => {
  const JobCategory = sequelize.define(
  "JobCategory",
  {
    job_category_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    job_category: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
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
    tableName: "job_categories",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  }
);

  JobCategory.associate = (models) => {
    JobCategory.hasMany(models.Job, {
      foreignKey: "job_category_id",
      as: "jobs",
    });
  };

  return JobCategory;
};
