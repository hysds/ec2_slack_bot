const Sequelize = require("sequelize");

module.exports = (sequelize) => {
  const model = sequelize.define(
    "Warnings",
    {
      // attributes
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
      },
    },
    {
      // options
      indexes: [
        {
          unique: true,
          fields: ["instance_id"],
        },
      ],
      freezeTableName: true,
      tableName: "warnings",
    }
  );

  model.getByInstanceID = async function (id) {
    return this.findOne({
      where: { instanceId: id },
    });
  };

  model.removeInstanceById = async function (id) {
    return this.destroy({
      where: { instanceId: id },
    });
  };

  model.createWarning = async function (id, name, launch) {
    return this.create({
      instanceId: id,
      name: name,
      launchDate: launch,
    });
  };

  model.prototype.postponeShutdown = async function (delayTime) {
    return this.update({
      delayShutdown: delayTime,
      strikes: 1,
    });
  };

  model.prototype.silenceInstance = async function () {
    return this.update({
      silenced: true,
      delayShutdown: null,
    });
  };

  return model;
};

// exports.model = model;
