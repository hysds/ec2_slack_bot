const AWS = require("aws-sdk");
var sanitizer = require("sanitizer");

const {
  AWS_REGION,
  SQS_QUEUE_URL,
  SLACK_POSTPONE_EVENT,
  SLACK_SILENCE_EVENT,
} = require("../settings");

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

const { InstanceWarningModel } = require("../sequelize/models");
const { logger } = require("../logger");

AWS.config.region = AWS_REGION;

const params = {
  AttributeNames: ["SentTimestamp"],
  MaxNumberOfMessages: 10,
  MessageAttributeNames: ["All"],
  QueueUrl: SQS_QUEUE_URL,
  VisibilityTimeout: 10,
  WaitTimeSeconds: 0,
};

const handleSlackEvent = async (id, action) => {
  try {
    const instance = await InstanceWarningModel.getByInstanceID(id);

    if (!instance) {
      logger.error(`instance not found in database: ${id}`);
      return false;
    }

    switch (action) {
      case SLACK_POSTPONE_EVENT:
        const newDelayShutdown = new Date(); // adding new delay shutdown time
        newDelayShutdown.setTime(newDelayShutdown.getTime() + 60 * 60 * 1000); // adding 1 hour
        await instance.postponeShutdown(newDelayShutdown);
        logger.info(`shutdown delayed: ${id} ${newDelayShutdown}`);
        break;
      case SLACK_SILENCE_EVENT:
        await instance.silenceInstance();
        logger.info(`instance silenced on slack: ${id}`);
        break;
    }
    return true;
  } catch (err) {
    logger.error(err);
    // throw err;
    return false;
  }
};

const processSqsMessage = async (err, data) => {
  if (err) {
    logger.error("Error from SQS");
    logger.error(err);
  } else if (data.Messages) {
    logger.info(`Received ${data.Messages.length} messages from SQS`);

    data.Messages.forEach(async (message) => {
      logger.info(`SQS message: ${JSON.stringify(message)}`);

      const body = JSON.parse(message.Body);
      let instanceId = body.instance_id;
      let action = body.action;

      // sanintizing the input to prevent XSS attacks
      instanceId = sanitizer.sanitize(instanceId, "string");
      action = sanitizer.sanitize(action, "string");

      logger.info(`SQS info: instance id: ${instanceId}, action: ${action}`);
      let foundInstance = await handleSlackEvent(instanceId, action);

      if (foundInstance) {
        const deleteParams = {
          QueueUrl: SQS_QUEUE_URL,
          ReceiptHandle: message.ReceiptHandle,
        };
        sqs.deleteMessage(deleteParams, function (err, data) {
          if (err) logger.error(`SQS Delete Error: ${err}`);
          else logger.info(`SQS Message deleted: ${JSON.stringify(data)}`);
        });
      }
    });
  }
};

exports.pollSqsMessages = () => sqs.receiveMessage(params, processSqsMessage);
