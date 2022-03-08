const { createHmac } = require("crypto");
const moment = require("moment-timezone");

const {
  SLACK_CHANNEL_ID,
  SLACK_POSTPONE_EVENT,
  SLACK_SILENCE_EVENT,
} = require("./settings");

exports.getHoursLaunched = (launch) => {
  const now = moment().utc();
  const launchTime = moment(launch).utc();
  return moment.duration(now.diff(launchTime)).asHours();
};

exports.sleep = (ms = 750) => new Promise((resolve) => setTimeout(resolve, ms));

exports.getTagValueByKey = (tags, key) => {
  const obj = tags.find((e) => e.Key === key);
  if (obj) return obj.Value;
  return null;
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

/**
 * O(N^2) list comparison of tags to list of white listed tags
 *     ex. [{ Key: 'Bravo', Value: 'adt' }...]
 * @param {Array.<Object>} tags - list of instance tags
 * @param {Array.<Object>} whitelist - list of whitelisted tags
 * @returns {Boolean}
 */
exports.checkWhitelist = (tags, whitelist) => {
  for (let i = 0; i < tags.length; i++) {
    for (let j = 0; j < whitelist.length; j++) {
      const { Key: tKey, Value: tValue } = tags[i];
      const { Key: wKey, Value: wValue } = whitelist[j];
      if (tKey === wKey && tValue === wValue) return true;
    }
  }
  return false;
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

exports.generateSlackShutdownMessage = (name, userId) => ({
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
