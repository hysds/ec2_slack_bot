const axios = require("axios");
const moment = require("moment-timezone");

const db = require("./db");
const { Users } = db.models;

const { sleep, hoursDiff, checkWorkHours } = require("./utils");
const {
  TIMEZONE,
  SLACK_TOKEN,
  SLACK_CHANNEL_ID,
  SLACK_POSTPONE_EVENT,
  SLACK_SILENCE_EVENT,
} = require("./settings");

const { logger } = require("./logger");

/**
 * https://api.slack.com/methods/users.lookupByEmail
 * @async
 * @param {String} email
 * @returns {Promise<Object|null>} - JSON object of user info from Slack's API (email, id, tz, etc)
 */
exports.getUserByEmail = async (email) => {
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

/**
 * validates slack user by email and checks if its during work hours
 * @async
 * @param {String} email
 * @returns {Promise<String|null>} - slack's user ID
 */
exports.validateUser = async (email) => {
  const user = await Users.getByEmail(email);
  let [slackUserID, tz] = [null, TIMEZONE];
  if (!user) {
    const slackUser = await this.getUserByEmail(email);
    if (slackUser && !slackUser.deleted) {
      const { id, timezone } = slackUser;
      await Users.createUser(email, id, timezone);
      [slackUserID, tz] = [id, timezone];
    }
  } else {
    let { updatedAt } = user.dataValues;
    if (hoursDiff(moment(updatedAt).utc()) >= 24) {
      const slackUser = await this.getUserByEmail(email); // get user info from slack
      if (slackUser && !slackUser.deleted) {
        if (!slackUser.deleted) {
          const { id, timezone } = slackUser;
          await user.updateInfo(id, timezone);
          [slackUserID, tz] = [id, timezone];
        } else {
          logger.info(`slack marked the user as deleted, deleting ${email}`);
          await Users.deleteByEmail(email); // delete the user if marked deleted by slack
        }
      }
    } else {
      const { slackUserId, timezone } = user.dataValues;
      [slackUserID, tz] = [slackUserId, timezone];
    }
  }
  return checkWorkHours(tz) ? slackUserID : null;
};

/**
 * create slack msg payload for a warning msg
 * @param {String} id - id of instance, ex. i-az123az123az123
 * @param {String} name - name of instance
 * @param {String|null} userId - (optional) slack user ID
 * @return {Object}
 */
exports.generateWarningMessage = (id, name, userId = null) => ({
  channel: SLACK_CHANNEL_ID,
  mrkdwn: true,
  text: userId
    ? `<@${userId}> Instance *_${name}_* has ran for too long, select option:`
    : `Instance *_${name}_* has ran for too long, select option:`,
  attachments: [
    {
      fallback: "Unable to Process",
      callback_id: "wopr_game",
      color: "#3AA3E3",
      attachment_type: "default",
      actions: [
        {
          name: SLACK_POSTPONE_EVENT,
          text: "Postpone",
          type: "button",
          style: "primary",
          value: id,
        },
        {
          name: SLACK_SILENCE_EVENT,
          text: "Let it die",
          type: "button",
          style: "danger",
          value: id,
        },
      ],
    },
  ],
});

/**
 * create slack msg payload for a shutdown msg
 * @param {String} id - id of instance, ex. i-az123az123az123
 * @param {String} name - name of instance
 * @param {String|null} userId - (optional) slack user ID
 * @return {Object}
 */
exports.generateShutdownMessage = (name, userId = null) => ({
  channel: SLACK_CHANNEL_ID,
  mrkdwn: true,
  text: userId
    ? `<@${userId}> Instance *_${name}_* is shutting down :sleeping:`
    : `Instance *_${name}_* is shutting down :sleeping:`,
});

/**
 * https://api.slack.com/methods/chat.postMessage
 * @async
 * @param {Object} msg
 */
exports.sendMsg = async (msg) => {
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

/**
 * send warning msg to slack
 * @param {String} id - id of instance, ex. i-az123az123az123
 * @param {String} name - name of instance
 * @param {String|null} userId - (optional) slack user ID
 */
exports.warnUser = async (id, name, userId = null) => {
  const msg = this.generateWarningMessage(id, name, userId);
  await this.sendMsg(msg);
  logger.info(`sent warning message to slack: ${name} (${id})`);
};
