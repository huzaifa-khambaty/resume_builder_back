module.exports = (sequelize, DataTypes) => {
  const CandidateSubscription = sequelize.define(
    "CandidateSubscription",
    {
      subscription_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      candidate_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "candidates",
          key: "candidate_id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      plan_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "subscription_plans",
          key: "plan_id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      braintree_subscription_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      braintree_transaction_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      country_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 1,
        },
      },
      total_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      start_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      end_date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM("pending", "active", "expired", "cancelled"),
        allowNull: false,
        defaultValue: "pending",
      },
      payment_status: {
        type: DataTypes.ENUM("pending", "completed", "failed", "refunded"),
        allowNull: false,
        defaultValue: "pending",
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
      tableName: "candidate_subscriptions",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        {
          fields: ["candidate_id"],
        },
        {
          fields: ["plan_id"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["start_date", "end_date"],
        },
        {
          fields: ["braintree_subscription_id"],
        },
      ],
    }
  );

  CandidateSubscription.associate = (models) => {
    CandidateSubscription.belongsTo(models.Candidate, {
      foreignKey: "candidate_id",
      as: "candidate",
    });
    CandidateSubscription.belongsTo(models.SubscriptionPlan, {
      foreignKey: "plan_id",
      as: "plan",
    });
    CandidateSubscription.hasMany(models.SubscriptionCountry, {
      foreignKey: "subscription_id",
      as: "countries",
    });
  };

  return CandidateSubscription;
};
