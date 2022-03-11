const aws = require("aws-sdk");
const moment = require("moment-timezone");

const slack = require("./slack");
const db = require("./db");
const { Warnings } = db.models;

const {
  getTagValueByKey,
  hoursDiff,
  generateTagFilters,
  checkWhitelist,
  getInstanceOwner,
} = require("./utils");

const {
  PRODUCTION_MODE,
  WHITE_LIST_FILTERS,
  INSTANCE_TIME_LIMIT,
  MAX_WARNINGS,
} = require("./settings");

const { logger } = require("./logger");

module.exports = class InstanceAnalyzer {
  constructor(region) {
    this.ec2 = new aws.EC2({ region });
  }

  /**
   * Delete record from DB and shutdown instance
   * @async
   * @param {String} id - id of instance, ex. i-az123az123az123
   * @param {String} name - name of instance
   * @param {String} userId - (optional) slack user ID
   */
  removeInstanceAndMsgSlack = async (id, name, userId = null) => {
    await Warnings.removeByInstanceId(id);
    const slackShutdownMsg = slack.generateShutdownMessage(name, userId);
    await slack.sendMsg(slackShutdownMsg);
    logger.info(`shutdown message sent to slack: ${name} (${id})`);
  };

  /**
   * shutdown ec2 instance
   * @async
   * @param {String} id - id of instance
   */
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

  /**
   * Iteate over active ec2 instances check the following:
   *  1) skip if instance tag has whitelisted tag
   *  2) check if instance has been running for >= X hrs, skip if less
   *  3) (optional) check for tag owner's slack user ID, skip if user not found
   *  4) if all checks pass, do one of following:
   *    - create warning in DB and send message to slack (tag user if applicable)
   *    - add strike to instance and send msg to slack
   *    - if # of strikes reaches limit, shutdown instance and send msg to slack
   * @async
   * @param {Array.<Object>} tagFilters - filter for ec2 instances
   */
  checkInstances = async (tagFilters) => {
    const params = generateTagFilters(tagFilters);
    try {
      const instances = await this.ec2.describeInstances(params).promise();
      for (const row of instances.Reservations) {
        const metadata = row.Instances[0];
        const { InstanceId: id, Tags, LaunchTime } = metadata;
        const name = getTagValueByKey(Tags, "Name");
        const hoursLaunched = hoursDiff(LaunchTime);
        const isWhitelisted = checkWhitelist(Tags, WHITE_LIST_FILTERS); // skip if instance has whitelisted tag
        if (isWhitelisted) {
          logger.info(`${name} (${id}) whitelisted, skipping`);
          continue;
        }
        logger.info(`(${hoursLaunched.toFixed(2)}hrs) ${name} - ${LaunchTime}`);
        logger.info(`tags: ${JSON.stringify(Tags)}`);
        if (hoursLaunched < INSTANCE_TIME_LIMIT) continue;

        const email = getInstanceOwner(Tags);
        const slackUserId = email ? await slack.validateUser(email) : null;

        const record = await Warnings.getByInstanceID(id); // checking database if instance has been audited
        if (!record) {
          await Warnings.createWarning(id, name, LaunchTime); // create record in table
          await slack.warnUser(id, name, slackUserId); // send warning message to slack
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
          if (!silenced) await slack.warnUser(id, name); //, slackUserId);
          continue;
        }
        if (PRODUCTION_MODE) await this.shutdownInstance(id);
        else logger.info(`prod mode set to FALSE, will not shut down ${name}`);
        await this.removeInstanceAndMsgSlack(id, name, slackUserId); // message slack and shut down instance
      }
    } catch (err) {
      logger.error(err.stack);
    }
  };
};
