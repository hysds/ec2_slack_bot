const { createHmac } = require("crypto");
const {
  SLACK_CHANNEL_ID,
  SLACK_POSTPONE_EVENT,
  SLACK_SILENCE_EVENT,
} = require("./settings");

exports.getHoursSinceLaunch = (launch) =>
  Math.floor((new Date() - launch) / 1000 / 60 / 60);

exports.sleep = (ms = 750) => new Promise((resolve) => setTimeout(resolve, ms));

exports.getTagValueByKey = (tags, key) => {
  const obj = tags.find((e) => e.Key === key);
  if (obj) return obj.Value;
  return null;
};

exports.getInstanceOwner = (tags) => {
  const owner = this.getTagValueByKey(tags, "Owner") || "";
  console.log("owner in getInstanceOwner: ", owner);
  return owner.includes("@") ? owner : null;
};

exports.generateTagFilters = (filters) => {
  const customTagFilters = filters.map((filter) => ({
    Name: `tag:${filter.key}`,
    Values: [filter.value],
  }));

  return {
    Filters: [
      { Name: "instance-state-name", Values: ["running"] },
      ...customTagFilters,
    ],
  };
};

exports.checkWhitelist = (tags, whitelist) => {
  // white list filters: [{ Key: "Owner", Value: "test_email@email.com" }]
  // tags in the ec2 instance metadata: ex. [{ Key: 'Bravo', Value: 'adt' }...]
  for (let i = 0; i < tags.length; i++) {
    for (let j = 0; j < whitelist.length; j++) {
      if (
        tags[i].Key === whitelist[j].Key &&
        tags[i].Value === whitelist[j].Value
      )
        return true;
    }
  }
  return false;
};

exports.generateSlackWarningMessage = (
  instanceId,
  instanceName,
  slackUserId = null
) => ({
  channel: SLACK_CHANNEL_ID,
  mrkdwn: true,
  text: slackUserId
    ? `<@${slackUserId}> Instance *_${instanceName}_* has ran for too long, select option:`
    : `Instance *_${instanceName}_* has ran for too long, select option:`,
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
          value: instanceId,
        },
        {
          name: SLACK_SILENCE_EVENT,
          text: "Let it die",
          type: "button",
          style: "danger",
          value: instanceId,
        },
      ],
    },
  ],
});

exports.generateSlackShutdownMessage = (instanceName) => ({
  channel: SLACK_CHANNEL_ID,
  mrkdwn: true,
  text: `Instance *_${instanceName}_* is shutting down :sleeping:`,
});

exports.validateSignature = (signingSecret, reqBody, headers) => {
  const timestamp = headers["x-slack-request-timestamp"];
  const sigBasestring = "v0:" + timestamp + ":" + reqBody;

  const hash = createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex");
  return `v0=${hash}`;
};
