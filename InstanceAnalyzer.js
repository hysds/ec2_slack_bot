const axios = require("axios");
const moment = require("moment-timezone");

const aws = require("aws-sdk");

const db = require("./db");
const { Warnings } = db.models;

const {
  getTagValueByKey,
  getHoursLaunched,
  sleep,
  generateTagFilters,
  generateSlackWarningMessage,
  generateSlackShutdownMessage,
  checkWhitelist,
} = require("./utils");

const {
  PRODUCTION_MODE,
  SLACK_TOKEN,
  WHITE_LIST_FILTERS,
  INSTANCE_TIME_LIMIT,
  MAX_WARNINGS,
} = require("./settings");

const { logger } = require("./logger");

class InstanceAnalyzer {
  constructor(region) {
    this.ec2 = new aws.EC2({ region });
  }

  sendSlackMsg = async (slackMsg) => {
    await sleep();
    const endpoint = "https://slack.com/api/chat.postMessage";
    const config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SLACK_TOKEN}`,
      },
    };
    try {
      const res = await axios.post(endpoint, slackMsg, config);
      if (res.status !== 200) logger.error(res);
      else {
        const { data } = res;
        if (!data.ok) logger.error(data.error);
      }
    } catch (err) {
      logger.error(`${JSON.stringify(slackMsg)} failed to send`);
      logger.error(err.stack);
    }
  };

  warnUser = async (id, name) => {
    const slackWarningMsg = generateSlackWarningMessage(id, name);
    await this.sendSlackMsg(slackWarningMsg);
    logger.info(`sent warning message to slack ${name} - ${id}`);
  };

  removeInstanceAndMsgSlack = async (id, name) => {
    await Warnings.removeByInstanceId(id);
    const slackShutdownMsg = generateSlackShutdownMessage(name);
    await this.sendSlackMsg(slackShutdownMsg);
    logger.info(`shutdown message sent to slack ${name} - ${id}`);
  };

  shutdownInstance = async (id) => {
    logger.info(`${id} warned ${MAX_WARNINGS}+ times, shutting down...`);
    const param = { InstanceIds: [id] };
    try {
      const stopInstance = await this.ec2.stopInstances(param).promise();
      logger.info(stopInstance);
    } catch (err) {
      logger.error(err.stack);
    }
  };

  checkInstances = async (tagFilters) => {
    const param = generateTagFilters(tagFilters);
    try {
      const instances = await this.ec2.describeInstances(param).promise();
      for (const row of instances.Reservations) {
        const metadata = row.Instances[0];
        const { InstanceId: id, Tags, LaunchTime } = metadata;
        const name = getTagValueByKey(Tags, "Name");
        const hoursLaunched = getHoursLaunched(LaunchTime);

        const isWhitelisted = checkWhitelist(Tags, WHITE_LIST_FILTERS); // skip if instance has whitelisted tag
        if (isWhitelisted) {
          logger.info(`${name} (${id}) whitelisted, skipping!`);
          continue;
        }
        logger.info(`${name} (${id}) - ${hoursLaunched} hrs - ${LaunchTime}`);
        logger.info(`tags: ${JSON.stringify(Tags)}`);
        if (hoursLaunched < INSTANCE_TIME_LIMIT) continue;

        const record = await Warnings.getByInstanceID(id); // checking database if instance has been audited
        if (!record) {
          await Warnings.createWarning(id, name, LaunchTime); // create record in table
          await this.warnUser(id, name); // send warning message to slack
          continue;
        }

        const { delayShutdown } = record;
        const { strikes, silenced } = record.dataValues;
        if (delayShutdown && moment().utc() < moment(delayShutdown).utc()) {
          logger.info(`instance is safe, will not warn: ${id}`); // less than delayshutdown time, do nothing
          continue;
        }

        if (strikes < MAX_WARNINGS) {
          await record.addStrike();
          if (!silenced) await this.warnUser(id, name, silenced);
          continue;
        }

        // if enough warnings, message slack and shut down instance
        if (PRODUCTION_MODE) await this.shutdownInstance(id);
        else logger.info(`prod mode set to FALSE, will not shut down ${name}`);
        await this.removeInstanceAndMsgSlack(id, name);
      }
    } catch (err) {
      logger.error(err.stack);
    }
  };
}

exports.InstanceAnalyzer = InstanceAnalyzer;
