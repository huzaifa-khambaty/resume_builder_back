module.exports = (sequelize, DataTypes) => {
  const Simulation = sequelize.define(
    "Simulation",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      candidate_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      country_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      job_category_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      no_of_jobs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      short_listed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
      tableName: "simulations",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
    }
  );

  Simulation.associate = (models) => {
    Simulation.belongsTo(models.Candidate, {
      foreignKey: "candidate_id",
      as: "candidate",
    });
    Simulation.belongsTo(models.Country, {
      foreignKey: "country_id",
      as: "country",
    });
    Simulation.belongsTo(models.JobCategory, {
      foreignKey: "job_category_id",
      as: "job_category",
    });
  };

  return Simulation;
};
