const Sequelize = require("sequelize");
const moment = require("moment-timezone");

const { TIMEZONE } = require("../../settings");
const { logger } = require("../../logger");

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
        defaultValue: Sequelize.NOW,
      },
    },
    {
      // options
      freezeTableName: true,
      tableName: "users",
      timestamps: true,
      updatedAt: "updated_at",
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

  model.deleteByEmail = async function (email) {
    return await this.destroy({
      where: { email },
    });
  };

  model.createUser = async function (email, id, tz) {
    logger.info(`creating user: ${email} ${id} ${tz || TIMEZONE}`);
    return await this.create({
      email,
      slackUserId: id,
      timezone: tz || TIMEZONE,
    });
  };

  model.prototype.updateInfo = async function (id, tz) {
    logger.info(`updating user: ${this.email} (${id}) - ${tz}`);
    return await this.update({
      slackUserId: id,
      timezone: tz || TIMEZONE,
      updatedAt: moment().utc(),
    });
  };

  return model;
};
