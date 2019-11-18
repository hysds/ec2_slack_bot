var crypto = require("crypto");

const {
  SLACK_CHANNEL_ID,
  SLACK_POSTPONE_EVENT,
  SLACK_SILENCE_EVENT
} = require("./settings");

exports.getInstanceName = tags => {
  NAME_KEY = "Name";
  const name = tags.find(e => e.Key === NAME_KEY);
  if (name) return name.Value;
  else return null;
};

exports.getTagValueByKey = (tags, key) => {
  const obj = tags.find(e => e.Key === key);
  if (obj) return obj.Value;
  else return null;
};

exports.generateTagFilters = filters => {
  const customTagFilters = filters.map(filter => ({
    Name: `tag:${filter.key}`,
    Values: [filter.value]
  }));

  return {
    Filters: [
      { Name: "instance-state-name", Values: ["running"] },
      ...customTagFilters
    ]
  };
};

exports.checkWhitelist = (tags, whitelist) => {
  // settings.WHITE_LIST_FILTERS: [{ Key: "Owner", Value: "test_email@email.com" }]
  // tags in the ec2 instance metadata: ex. [{ Key: 'Bravo', Value: 'adt' }...]

  for (let i = 0; i < tags.length; i++) {
    for (let j = 0; j < whitelist.length; j++) {
      if (
        tags[i].Key === whitelist[j].Key &&
        tags[i].Value === whitelist[j].Value
      ) {
        return true;
      }
    }
  }
  return false;
};

exports.generateSlackWarningMessage = (instanceId, instanceName) => ({
  channel: SLACK_CHANNEL_ID,
  mrkdwn: true,
  text: `Instance *_${instanceName}_* has ran for too long, select option:`,
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
          value: instanceId
        },
        {
          name: SLACK_SILENCE_EVENT,
          text: "Let it die",
          type: "button",
          style: "danger",
          value: instanceId
        }
      ]
    }
  ]
});

exports.generateSlackShutdownMessage = instanceName => ({
  channel: SLACK_CHANNEL_ID,
  mrkdwn: true,
  text: `Instance *_${instanceName}_* is shutting down :sleeping:`
});

exports.validateSignature = (signingSecret, reqBody, headers) => {
  const timestamp = headers["x-slack-request-timestamp"];
  const sigBasestring = "v0:" + timestamp + ":" + reqBody;

  const hash = crypto
    .createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex");
  return "v0=" + hash;
};
