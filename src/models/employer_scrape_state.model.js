"use strict";

module.exports = (sequelize, DataTypes) => {
  const EmployerScrapeState = sequelize.define(
    "EmployerScrapeState",
    {
      state_id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      last_country_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      last_job_category_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      running: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      last_run_status: {
        type: DataTypes.ENUM("success", "error"),
        allowNull: true,
      },
      last_error: {
        type: DataTypes.TEXT,
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
      tableName: "employer_scrape_states",
      underscored: true,
      timestamps: false,
    }
  );

  EmployerScrapeState.associate = function () {
    // no associations
  };

  return EmployerScrapeState;
};
