const { createHmac } = require("crypto");
const moment = require("moment-timezone");

const {
  TIMEZONE,
  SLACK_CHANNEL_ID,
  SLACK_POSTPONE_EVENT,
  SLACK_SILENCE_EVENT,
} = require("./settings");

exports.hoursDiff = (launch) => {
  const now = moment().utc();
  const launchTime = moment(launch).utc();
  return moment.duration(now.diff(launchTime)).asHours();
};

exports.sleep = (ms = 750) => new Promise((resolve) => setTimeout(resolve, ms));

exports.getTagValueByKey = (tags, key) => {
  const obj = tags.find((e) => e.Key === key);
  return obj ? obj.Value : null;
};

exports.getInstanceOwner = (tags) => {
  const owner = this.getTagValueByKey(tags, "Owner") || "";
  return owner.includes("@") ? owner : null;
};

/**
 * function to create filter params to describe ec2 instances
 * ex. { Filters: [{ Name: 'tag:Project', Values: ['foo'] }, ...] }
 * @param {Array.<Object>}
 * @returns {Array.<Object>}
 */
exports.generateTagFilters = (filters) => ({
  Filters: [
    { Name: "instance-state-name", Values: ["running"] },
    ...filters.map((filter) => ({
      Name: `tag:${filter.key}`,
      Values: [filter.value],
    })),
  ],
});

exports.checkWorkHours = (tz = null) => {
  tz = tz || TIMEZONE;
  const now = moment().utc().tz(tz);
  const day = now.day();
  const hour = now.hour();
  if (day > 0 && day < 6 && hour > 7 && hour < 18) return true; // 8am - 7pm weekdays
  return false;
};

/**
 * O(N) list comparison of tags to list of white listed tags
 *     ex. [{ Key: 'Bravo', Value: 'adt' }...]
 * @param {Array.<Object>} tags - list of instance tags
 * @param {Array.<Object>} whitelist - list of whitelisted tags
 * @returns {Boolean}
 */
exports.checkWhitelist = (tags, whitelist) => {
  const _tags = tags.map((t) => JSON.stringify(t)); // object vs string comparison: O(N^2) -> O(N)
  const _whitelist = new Set(whitelist.map((t) => JSON.stringify(t)));
  const hasTag = _tags.find((t) => _whitelist.has(t)); // .find() returns undefined if not found
  return hasTag !== undefined;
};

exports.generateSlackWarningMessage = (id, name, userId = null) => ({
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

exports.generateSlackShutdownMessage = (name, userId = null) => ({
  channel: SLACK_CHANNEL_ID,
  mrkdwn: true,
  text: userId
    ? `<@${userId}> Instance *_${name}_* is shutting down :sleeping:`
    : `Instance *_${name}_* is shutting down :sleeping:`,
});

exports.createSignature = (signingSecret, reqBody, headers) => {
  const timestamp = headers["x-slack-request-timestamp"];
  const sigBasestring = "v0:" + timestamp + ":" + reqBody;

  const hash = createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex");
  return `v0=${hash}`;
};
