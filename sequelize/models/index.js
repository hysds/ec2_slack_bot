const instanceWarning = require("./InstanceWarnings");
const slackUsers = require("./Users");

module.exports = {
  InstanceWarningModel: instanceWarning.model,
  SlackUsersModel: slackUsers.model,
};
