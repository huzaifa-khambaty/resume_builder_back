module.exports = (sequelize, DataTypes) => {
  const SubscriptionPlan = sequelize.define(
    "SubscriptionPlan",
    {
      plan_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
          len: [2, 100],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      duration_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
          max: 365,
        },
      },
      price_per_country: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      stripe_price_id: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Stripe Price ID for this subscription plan',
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
      tableName: "subscription_plans",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        {
          fields: ["is_active"],
        },
        {
          fields: ["created_at"],
        },
      ],
    }
  );

  SubscriptionPlan.associate = (models) => {
    SubscriptionPlan.hasMany(models.CandidateSubscription, {
      foreignKey: "plan_id",
      as: "subscriptions",
    });
  };

  return SubscriptionPlan;
};
