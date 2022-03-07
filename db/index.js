const path = require("path");
const Sequelize = require("sequelize");

const models = require("./models");
const { DEBUG } = require("../settings");
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
  await this.sync()
    .then(() => logger.info("Database tables synced"))
    .catch((err) => logger.error(err));
};

const create = () => {
  const dbLogger = (msg) => logger.info(msg);
  switch (DB_TYPE) {
    case "sqlite":
    case "sqlite3":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "sqlite",
        port: DB_PORT,
        pool: connectionPool,
        storage: path.join(DB_LOCATION, DB_NAME), // SQLite only
        logging: DEBUG ? dbLogger : false,
      });
    case "postgres":
    case "postgresql":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "postgres",
        host: DB_HOST,
        port: DB_PORT,
        pool: connectionPool,
        logging: false,
        logging: DEBUG ? dbLogger : false,
      });
    case "mysql":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "mysql",
        host: DB_HOST,
        port: DB_PORT,
        pool: connectionPool,
        logging: DEBUG ? dbLogger : false,
      });
    default:
      throw new Error("Database must be: postgres, mysql or sqlite");
  }
};

const db = create();
for (const model of models) model(db); // creating the tables

module.exports = db;
