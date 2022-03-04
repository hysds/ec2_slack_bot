const path = require("path");
const Sequelize = require("sequelize");

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

const databaseMapper = () => {
  switch (DB_TYPE) {
    case "sqlite":
    case "sqlite3":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "sqlite",
        port: DB_PORT,
        pool: connectionPool,
        storage: path.join(DB_LOCATION, DB_NAME), // SQLite only
        logging: false,
      });
    case "postgres":
    case "postgresql":
      return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
        dialect: "postgres",
        host: DB_HOST,
        port: DB_PORT,
        pool: connectionPool,
        logging: false,
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

const sequelize = databaseMapper();

sequelize
  .authenticate()
  .then(() => logger.info("Connected to database"))
  .catch((err) => {
    logger.error(`Unable to connect to the database: ${err}`);
    process.exit(1);
  });

exports.sequelize = sequelize;
