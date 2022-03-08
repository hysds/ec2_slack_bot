const axios = require("axios");
const moment = require("moment-timezone");

const aws = require("aws-sdk");

const db = require("./db");
const { Warnings, Users } = db.models;

const {
  sleep,
  getTagValueByKey,
  getHoursLaunched,
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
  TIMEZONE,
} = require("./settings");

const { logger } = require("./logger");

class InstanceAnalyzer {
  constructor(region) {
    this.ec2 = new aws.EC2({ region });
  }

  getSlackUserByEmail = async (email) => {
    const endpoint = `https://slack.com/api/users.lookupByEmail?token=${SLACK_TOKEN}&email=${email}`;
    try {
      const res = await axios.get(endpoint);
      const { data } = res;
      if (!data.ok) {
        logger.error(`slack rest API error: ${email} ${data.error}`);
        return null;
      }
      return {
        email,
        id: data.user.id,
        timezone: data.user.tz,
        deleted: data.user.deleted,
      };
    } catch (err) {
      logger.warn(`Unable to call slack rest API: users.lookupByEmail`);
      return null;
    }
  };

  sendSlackMsg = async (msg) => {
    await sleep();
    const endpoint = "https://slack.com/api/chat.postMessage";
    const config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SLACK_TOKEN}`,
      },
    };
    try {
      const res = await axios.post(endpoint, msg, config);
      if (res.status !== 200) logger.error(res);
      else {
        const { data } = res;
        if (!data.ok) logger.error(data.error);
      }
    } catch (err) {
      logger.error(`${JSON.stringify(msg)} failed to send`);
      logger.error(err.stack);
    }
  };

  warnUser = async (id, name, userId = null) => {
    const slackWarningMsg = generateSlackWarningMessage(id, name, userId);
    await this.sendSlackMsg(slackWarningMsg);
    logger.info(`sent warning message to slack ${name} - ${id}`);
  };

  removeInstanceAndMsgSlack = async (id, name, userId = null) => {
    await Warnings.removeByInstanceId(id);
    const slackShutdownMsg = generateSlackShutdownMessage(name, userId);
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
    const params = generateTagFilters(tagFilters);
    try {
      const instances = await this.ec2.describeInstances(params).promise();
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

        let slackUserId = null;
        const email = await getInstanceOwner(Tags);
        if (email) {
          const user = await Users.getByEmail(email);
          if (!user) {
            const slackUser = await this.getSlackUserByEmail(email);
            if (slackUser && !slackUser.deleted) {
              const { id, timezone } = slackUser;
              await Users.createUser(email, id, timezone);
              slackUserId = id;
            }
          } else {
            let { updatedAt } = user.dataValues;
            updatedAt = moment(updatedAt).utc();
            const now = moment().utc();
            if (moment.duration(now.diff(updatedAt)).asHours() >= 24) {
              const slackUser = await this.getSlackUserByEmail(email); // get user info from slack
              if (slackUser && !slackUser.deleted) {
                if (!slackUser.deleted) {
                  const { id, timezone } = slackUser;
                  await user.updateInfo(id, timezone || TIMEZONE);
                  slackUserId = id;
                } else await Users.deleteByEmail(email); // delete the user if marked deleted by slack
              }
            } else slackUserId = user.dataValues.slackUserId;
          }
        }

        const record = await Warnings.getByInstanceID(id); // checking database if instance has been audited
        if (!record) {
          await Warnings.createWarning(id, name, LaunchTime); // create record in table
          await this.warnUser(id, name, slackUserId); // send warning message to slack
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
          if (!silenced) await this.warnUser(id, name, slackUserId);
          continue;
        }

        // if enough warnings, message slack and shut down instance
        if (PRODUCTION_MODE) await this.shutdownInstance(id);
        else logger.info(`prod mode set to FALSE, will not shut down ${name}`);
        await this.removeInstanceAndMsgSlack(id, name, slackUserId);
      }
    } catch (err) {
      logger.error(err.stack);
    }
  };
}

exports.InstanceAnalyzer = InstanceAnalyzer;
