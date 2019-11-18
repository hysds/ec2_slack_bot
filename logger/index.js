const path = require("path");

const { createLogger, transports, format } = require("winston");
const { combine, timestamp, printf } = format;

const expressWinston = require("express-winston");
require("winston-daily-rotate-file");

const { LOG_DIR, DEBUG } = require("../settings");

const transportOptions = [
  new transports.DailyRotateFile({
    name: "ec2-bot-instance",
    datePattern: "YYYY-MM-DD",
    filename: path.join(LOG_DIR, "ec2-instance-bot.log")
  })
];
if (DEBUG) transportOptions.push(new transports.Console());

const serviceLogger = expressWinston.logger({
  format: combine(
    timestamp(),
    printf(({ level, message, timestamp, meta }) => {
      return `${timestamp} ${level} ${meta.res.statusCode}: ${message}`;
    })
  ),
  transports: transportOptions
});

const logger = createLogger({
  format: combine(
    timestamp(),
    printf(
      ({ level, message, timestamp }) => `${timestamp} ${level}: ${message}`
    )
  ),
  transports: transportOptions
});

exports.logger = logger;
exports.serviceLogger = serviceLogger;
