const axios = require("axios");

const { InstanceWarningModel } = require("./sequelize/models"); // SQL table - instance_warning

const {
  generateTagFilters,
  generateSlackWarningMessage,
  generateSlackShutdownMessage,
  getInstanceName,
  checkWhitelist
} = require("./utils");

const {
  PRODUCTION_MODE,
  SLACK_TOKEN,
  WHITE_LIST_FILTERS,
  INSTANCE_TIME_LIMIT,
  MAX_WARNINGS
} = require("./settings");

const { logger } = require("./logger");

class InstanceAnalyzer {
  constructor(aws, region) {
    this.aws = aws; // require('aws')
    this.aws.config.region = region;
    this.ec2 = new aws.EC2(); // ec2 object

    this.slackMsgTimesleepMS = 1000;
    this.sendSlackMessageURL = "https://slack.com/api/chat.postMessage";
  }

  // sleep for one second so there isnt a error 429
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  sendSlackMessage = async slackMsg => {
    const config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SLACK_TOKEN}`
      }
    };
    try {
      const res = await axios.post(this.sendSlackMessageURL, slackMsg, config);
      if (res.status !== 200) logger.error(res);
      logger.info(`sent warning message to slack`);
    } catch (err) {
      logger.error(`${JSON.stringify(slackMsg)} failed to send`);
      logger.error(err.stack);
    }
  };

  shutdownInstance = async id => {
    const param = { InstanceIds: [id] };
    try {
      const stopInstance = await this.ec2.stopInstances(param).promise();
      logger.info(stopInstance);
    } catch (err) {
      logger.error(err.stack);
    }
  };

  analyzeInstance = async (id, name, launchDate) => {
    // id: instance_id, name: tag (name), launch date of instance
    try {
      const instance = await InstanceWarningModel.getByInstanceID(id);
      if (!instance) {
        logger.info(`No instance warning in database with id: ${id}`);
        logger.info(`adding table record: ${id}`);

        await InstanceWarningModel.createWarning(id, name, launchDate);
        const slackWarningMsg = generateSlackWarningMessage(id, name);
        logger.info("slack message payload:");
        logger.info(JSON.stringify(slackWarningMsg));
        this.sendSlackMessage(slackWarningMsg); // send warning message to slack
      } else {
        logger.info(`${id} found in database table`);
        const now = new Date();
        const strikes = instance.dataValues.strikes;

        if (instance.delayShutdown && now < instance.delayShutdown) {
          // "now" is less than delayshutdown time, do nothing
          logger.info(`instance is safe, will not warn: ${id}`);
        } else {
          if (strikes >= MAX_WARNINGS) {
            logger.info(
              `${id} warned ${MAX_WARNINGS}+ times, shutting down instance`
            );
            if (PRODUCTION_MODE) {
              logger.info("prod mode set to TRUE, shut down");
              this.shutdownInstance(id);
            } else logger.info("prod mode set to FALSE, will not shut down");

            await InstanceWarningModel.removeInstanceById(id);
            const slackShutdownMsg = generateSlackShutdownMessage(name);
            logger.info("slack message payload:");
            logger.info(JSON.stringify(slackShutdownMsg));
            await this.sendSlackMessage(slackShutdownMsg);
            logger.info(`${name} shutdown message sent to slack`);
          } else {
            // send warning message to slack
            await instance.update({ strikes: strikes + 1 });
            if (!instance.silenced) {
              const slackWarningMsg = generateSlackWarningMessage(id, name);
              logger.info("slack message payload:");
              logger.info(JSON.stringify(slackWarningMsg));
              this.sendSlackMessage(slackWarningMsg);
              logger.info(`sent warning message to slack ${id}`);
            }
          }
        }
      }
    } catch (err) {
      logger.error(err.stack);
    }
  };

  checkInstances = async tagFilters => {
    const param = generateTagFilters(tagFilters);
    try {
      const instances = await this.ec2.describeInstances(param).promise();

      for (let i = 0; i < instances.Reservations.length; i++) {
        await this.sleep(this.slackMsgTimesleepMS);
        let row = instances.Reservations[i];
        const instance = row.Instances[0];
        const instanceId = instance.InstanceId; // getting instance information
        const tags = instance.Tags;
        const instanceName = getInstanceName(tags);
        const launchTime = instance.LaunchTime;
        const now = new Date();
        const hoursLaunched = Math.floor((now - launchTime) / 1000 / 60 / 60);

        logger.info(`instance name: ${instanceName}`);
        logger.info(`tags: ${JSON.stringify(tags)}`);
        logger.info(`launch: ${now}: ${hoursLaunched} hrs since launch`);

        // if instance has whitelisted tag, then skip
        const isWhitelisted = checkWhitelist(tags, WHITE_LIST_FILTERS);
        if (isWhitelisted)
          logger.info(`${instanceName} (${instanceId}) whitelisted, skipping!`);
        else if (hoursLaunched >= INSTANCE_TIME_LIMIT)
          this.analyzeInstance(instanceId, instanceName, launchTime);
      }
    } catch (err) {
      logger.error(err.stack);
    }
  };
}

exports.InstanceAnalyzer = InstanceAnalyzer;
