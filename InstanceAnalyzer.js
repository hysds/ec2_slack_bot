const axios = require("axios");

const { InstanceWarningModel, SlackUsersModel } = require("./sequelize/models"); // SQL table - instance_warning

const {
  getTagValueByKey,
  getHoursSinceLaunch,
  sleep,
  generateTagFilters,
  generateSlackWarningMessage,
  generateSlackShutdownMessage,
  checkWhitelist,
  getInstanceOwner,
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
  constructor(aws, region) {
    this.aws = aws; // require('aws')
    this.aws.config.region = region;
    this.ec2 = new aws.EC2(); // ec2 object
  }

  getSlackUserIdByEmail = async (email) => {
    const endpoint = `https://slack.com/api/users.lookupByEmail?token=${SLACK_TOKEN}&email=${email}`;
    try {
      const res = await axios.get(endpoint);
      const { data } = res;
      if (!data.ok) {
        logger.warn(`slack rest API error: ${email} ${data.error}`);
        return null;
      }
      return data.user.id;
    } catch (err) {
      logger.warn(`Unable to call slack rest API: users.lookupByEmail`);
      return null;
    }
  };

  checkSlackUser = async (email) => {
    const user = await SlackUsersModel.getByEmail(email);
    if (user) {
      logger.info("slack user found in database", email, user.slackUserId);
      return user.slackUserId;
    }
    logger.info("slack user not found in database, checking slack API");
    const slackUserId = await this.getSlackUserIdByEmail(email);
    if (slackUserId) {
      logger.info("Slack user found by email", slackUserId, email);
      await SlackUsersModel.createUser(slackUserId, email);
      logger.info("Slack user ID added to database");
      return slackUserId;
    }
    return null;
  };

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
    } catch (err) {
      logger.error(`${JSON.stringify(slackMsg)} failed to send`);
      logger.error(err.stack);
    }
  };

  shutdownInstance = async (id) => {
    const param = { InstanceIds: [id] };
    try {
      const stopInstance = await this.ec2.stopInstances(param).promise();
      logger.info(stopInstance);
    } catch (err) {
      logger.error(err.stack);
    }
  };

  // TODO: break this function into smaller functions
  analyzeInstance = async (id, name, launchDate) => {
    const instance = await InstanceWarningModel.getByInstanceID(id);
    if (!instance) {
      logger.info(`No record found in database, adding: ${id}`);
      await InstanceWarningModel.createWarning(id, name, launchDate);
      const slackWarningMsg = generateSlackWarningMessage(id, name);
      await this.sendSlackMsg(slackWarningMsg); // send warning message to slack
      return;
    }
    if (instance.delayShutdown && new Date() < instance.delayShutdown) {
      logger.info(`instance is safe, will not warn: ${id}`); // less than delayshutdown time, do nothing
      return;
    }

    const strikes = instance.dataValues.strikes;
    if (strikes >= MAX_WARNINGS) {
      logger.info(`${id} warned ${MAX_WARNINGS}+ times, shutting down...`);
      if (PRODUCTION_MODE) await this.shutdownInstance(id);
      else logger.info("prod mode set to FALSE, will not shut down");

      await InstanceWarningModel.removeInstanceById(id);
      const slackShutdownMsg = generateSlackShutdownMessage(name);
      await this.sendSlackMsg(slackShutdownMsg);
      logger.info(`${name} shutdown message sent to slack`);
      return;
    }
    // send warning message to slack
    await instance.update({ strikes: strikes + 1 });
    if (!instance.silenced) {
      const slackWarningMsg = generateSlackWarningMessage(id, name);
      await this.sendSlackMsg(slackWarningMsg);
      logger.info(`sent warning message to slack ${id}`);
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
        const hoursLaunched = getHoursSinceLaunch(LaunchTime);

        // if instance has whitelisted tag, then skip
        const isWhitelisted = checkWhitelist(Tags, WHITE_LIST_FILTERS);
        if (isWhitelisted) {
          logger.info(`${name} (${id}) whitelisted, skipping!`);
          continue;
        }
        logger.info(`${name} (${id}) - ${hoursLaunched} hrs - ${LaunchTime}`);
        logger.info(`tags: ${JSON.stringify(Tags)}`);
        if (hoursLaunched < INSTANCE_TIME_LIMIT) continue;

        await this.analyzeInstance(id, name, LaunchTime);
      }
    } catch (err) {
      logger.error(err.stack);
    }
  };
}

exports.InstanceAnalyzer = InstanceAnalyzer;
