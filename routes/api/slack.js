const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");

const { InstanceWarningModel } = require("../../sequelize/models");

const { logger, serviceLogger } = require("../../logger");
const { validateSignature } = require("../../utils");
const {
  SLACK_POSTPONE_EVENT,
  SLACK_SILENCE_EVENT,
  SLACK_SIGNING_SECRET
} = require("../../settings");

router.use(serviceLogger);
router.use(bodyParser.text({ type: "*/*" }));

router.post("/instance-action", async (req, res) => {
  const body = req.body;
  const headers = req.headers;
  const slackSignature = headers["x-slack-signature"];

  const computedHash = validateSignature(SLACK_SIGNING_SECRET, body, headers);

  logger.info(`x-slack-signature: ${slackSignature}`);
  logger.info(`computed slack signature: ${computedHash}`);

  if (headers["x-slack-signature"] !== computedHash) {
    logger.error("Signing Signature Invalid!");
    res.status(401).send("Signing Signature Invalid!");
    return;
  }

  let payload = decodeURIComponent(body);
  logger.info(payload);
  payload = payload.replace("payload=", "");
  payload = JSON.parse(payload);

  try {
    const action = payload.actions[0];
    let instanceId = action.value;
    let actionType = action.name;

    // sanintizing the input to prevent XSS attacks
    instanceId = sanitizer.sanitize(instanceId, "string");
    actionType = sanitizer.sanitize(actionType, "string");

    const instance = await InstanceWarningModel.getByInstanceID(instanceId);

    if (!instance) {
      logger.error(`Instance not found in database ${instanceId}`);
      logger.info(
        `Instance most likely already shut down, sending "success message" message to slack: ${instanceId}`
      );
      res.send("Instance already shut down! :man-shrugging:");
      return;
    }

    switch (actionType) {
      case SLACK_POSTPONE_EVENT:
        const newDelayShutdown = new Date(); // adding new delay shutdown time
        newDelayShutdown.setTime(newDelayShutdown.getTime() + 60 * 60 * 1000); // adding 1 hour

        await instance.postponeShutdown(newDelayShutdown);
        logger.info(`shutdown delayed: ${instanceId} ${newDelayShutdown}`);
        res.send("Instance shutdown delayed 1 hour!");
        break;
      case SLACK_SILENCE_EVENT:
        await instance.silenceInstance();
        logger.info(`instance silenced on slack: ${instanceId}`);
        res.send("Instance silenced on Slack!");
        break;
    }
  } catch (err) {
    logger.error(err.stack);
    res.status(500).send("INTERNAL SERVER ERROR!");
  }
});

module.exports = router;
