module.exports = (sequelize, DataTypes) => {
  const SubscriptionCountry = sequelize.define(
    "SubscriptionCountry",
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      subscription_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "candidate_subscriptions",
          key: "subscription_id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      country_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "countries",
          key: "country_id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
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
      tableName: "subscription_countries",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        {
          unique: true,
          fields: ["subscription_id", "country_id"],
          name: "unique_subscription_country",
        },
        {
          fields: ["subscription_id"],
        },
        {
          fields: ["country_id"],
        },
      ],
    }
  );

  SubscriptionCountry.associate = (models) => {
    SubscriptionCountry.belongsTo(models.CandidateSubscription, {
      foreignKey: "subscription_id",
      as: "subscription",
    });
    SubscriptionCountry.belongsTo(models.Country, {
      foreignKey: "country_id",
      as: "country",
    });
  };

  return SubscriptionCountry;
};
