const Sequelize = require("sequelize");
const config = require("../config");
const { TIMEZONE, LOCALE } = require("../../settings");

const SlackUsers = config.sequelize.define(
  "slack_users",
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

SlackUsers.getByEmail = async function (email) {
  return this.findOne({
    where: { email },
  });
};

SlackUsers.createUser = async function (userId, email) {
  return this.create({
    slackUserId: userId,
    email,
  });
};

SlackUsers.prototype.updateUser = async function (userId) {
  this.update({
    slackUserId: userId,
  });
};

SlackUsers.sync({ force: false });

exports.model = SlackUsers;
