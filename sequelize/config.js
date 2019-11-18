const path = require("path");
const Sequelize = require("sequelize");

const { logger } = require("../logger");

const logStream = msg => {
  logger.info(msg);
};

const {
  DB_TYPE,
  DB_HOST,
  DB_USERNAME,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT,
  DB_LOCATION
} = require("../settings");

const connectionPool = {
  max: 10,
  min: 0,
  acquire: 30000,
  idle: 10000
};

const databaseMapper = () => {
  switch (DB_TYPE) {
    case "sqlite":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "sqlite",
        port: DB_PORT,
        pool: connectionPool,
        storage: path.join(DB_LOCATION, DB_NAME), // SQLite only
        logging: logStream
      });
    case "postgres":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "postgres",
        host: DB_HOST,
        port: DB_PORT,
        pool: connectionPool,
        logging: logStream
      });
    case "postgresql":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "postgres",
        host: DB_HOST,
        pool: connectionPool,
        logging: logStream
      });
    case "mysql":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "mysql",
        host: DB_HOST,
        port: DB_PORT,
        pool: connectionPool,
        logging: logStream
      });
  }
};

const sequelize = databaseMapper();

sequelize
  .authenticate()
  .then(() => logger.info("Connection has been established successfully."))
  .catch(err => logger.error(`Unable to connect to the database: ${err}`));

exports.sequelize = sequelize;
