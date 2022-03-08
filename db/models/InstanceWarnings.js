const Sequelize = require("sequelize");

const { logger } = require("../../logger");

module.exports = (sequelize) => {
  const model = sequelize.define(
    "Warnings",
    {
      instanceId: {
        type: Sequelize.STRING,
        field: "instance_id",
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        field: "name",
      },
      strikes: {
        type: Sequelize.INTEGER,
        field: "strikes",
        allowNull: false,
        defaultValue: 1,
      },
      launchDate: {
        type: Sequelize.DATE,
        field: "launch_date",
        allowNull: false,
      },
      delayShutdown: {
        type: Sequelize.DATE,
        field: "delay_shutdown",
      },
      silenced: {
        type: Sequelize.BOOLEAN,
        field: "silenced",
        allowNull: false,
        defaultValue: false,
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
      tableName: "warnings",
      timestamps: true,
      updatedAt: "updated_at",
      indexes: [
        {
          unique: true,
          fields: ["instance_id"],
        },
      ],
    }
  );

  model.createWarning = async function (id, name, launch) {
    logger.info(`adding warning: ${name} (${id}) - ${launch}`);
    return await this.create({
      instanceId: id,
      name: name,
      launchDate: launch,
    });
  };

  model.getByInstanceID = async function (id) {
    return await this.findOne({
      where: { instanceId: id },
    });
  };

  model.removeByInstanceId = async function (id) {
    return await this.destroy({
      where: { instanceId: id },
    });
  };

  model.prototype.addStrike = async function () {
    logger.info(`adding strike to instance: ${this.dataValues.instanceId}`);
    return await this.increment("strikes", { by: 1 });
  };

  model.prototype.postponeShutdown = async function () {
    logger.info(`shutdown delayed: ${this.dataValues.instanceId} ${timestamp}`);
    return await this.update({
      delayShutdown: moment().utc().add(1, "hours"),
      strikes: 1,
    });
  };

  model.prototype.silenceInstance = async function () {
    return await this.update({
      silenced: true,
      delayShutdown: null,
    });
  };

  return model;
};
