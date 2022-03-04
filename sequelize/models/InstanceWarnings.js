const Sequelize = require("sequelize");
const config = require("../config");

const InstanceWarnings = config.sequelize.define(
  "instance_warnings",
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
  }
);

InstanceWarnings.getByInstanceID = async function (id) {
  return this.findOne({
    where: { instanceId: id },
  });
};

InstanceWarnings.removeInstanceById = async function (id) {
  return this.destroy({
    where: { instanceId: id },
  });
};

InstanceWarnings.createWarning = async function (id, name, launch) {
  return this.create({
    instanceId: id,
    name: name,
    launchDate: launch,
  });
};

InstanceWarnings.prototype.postponeShutdown = async function (delayTime) {
  return this.update({
    delayShutdown: delayTime,
    strikes: 1,
  });
};

InstanceWarnings.prototype.silenceInstance = async function () {
  return this.update({
    silenced: true,
    delayShutdown: null,
  });
};

InstanceWarnings.sync({ force: false });

exports.model = InstanceWarnings;
