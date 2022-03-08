const Sequelize = require("sequelize");

const { TIMEZONE } = require("../../settings");

module.exports = (sequelize) => {
  const model = sequelize.define(
    "Users",
    {
      slackUserId: {
        type: Sequelize.STRING,
        field: "slack_user_id",
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        field: "email",
        allowNull: false,
      },
      timezone: {
        type: Sequelize.STRING,
        field: "timezone",
        defaultValue: TIMEZONE,
      },
      createdAt: {
        type: Sequelize.DATE,
        field: "created_at",
      },
      updatedAt: {
        type: Sequelize.DATE,
        field: "updated_at",
      },
    },
    {
      // options
      freezeTableName: true,
      tableName: "users",
      indexes: [
        {
          unique: true,
          fields: ["slack_user_id"],
        },
        {
          unique: true,
          fields: ["email"],
        },
      ],
    }
  );

  model.getByEmail = async function (email) {
    return await this.findOne({
      where: { email },
    });
  };

  model.createUser = async function (userId, email) {
    return await this.create({
      slackUserId: userId,
      email,
    });
  };

  model.prototype.updateUser = async function (userId) {
    await this.update({
      slackUserId: userId,
    });
  };

  return model;
};
