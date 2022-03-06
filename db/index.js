const path = require("path");
const Sequelize = require("sequelize");

const defineInstanceModel = require("./models/InstanceWarnings");
const defineUserModel = require("./models/Users");

const { logger } = require("../logger");

const {
  DB_TYPE,
  DB_HOST,
  DB_USERNAME,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT,
  DB_LOCATION,
} = require("../settings");

const connectionPool = {
  max: 10,
  min: 0,
  acquire: 30000,
  idle: 10000,
};

Sequelize.prototype.init = async function () {
  await this.authenticate()
    .then(() => logger.info("Connected to database"))
    .catch((err) => {
      logger.error(`Unable to connect to the database: ${err}`);
      process.exit(1);
    });
  await this.sync().catch((err) => logger.error(err));
};

const create = () => {
  switch (DB_TYPE) {
    case "sqlite":
    case "sqlite3":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "sqlite",
        port: DB_PORT,
        pool: connectionPool,
        storage: path.join(DB_LOCATION, DB_NAME), // SQLite only
        logging: false,
        // logging: (msg) => logger.info(msg),
      });
    case "postgres":
    case "postgresql":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "postgres",
        host: DB_HOST,
        port: DB_PORT,
        pool: connectionPool,
        logging: false,
        // logging: (msg) => logger.info(msg),
      });
    case "mysql":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "mysql",
        host: DB_HOST,
        port: DB_PORT,
        pool: connectionPool,
        logging: false,
      });
    default:
      throw new Error("Database must be: postgres, mysql or sqlite");
  }
};

const db = create();
defineInstanceModel(db);
defineUserModel(db);

module.exports = db;

// sequelize
//   .authenticate()
//   .then(() => logger.info("Connected to database"))
//   .catch((err) => {
//     logger.error(`Unable to connect to the database: ${err}`);
//     process.exit(1);
//   });

// exports.sequelize = sequelize;
