const AWS = require("aws-sdk");
const sanitizer = require("sanitizer");

const {
  AWS_REGION,
  SQS_QUEUE_URL,
  SLACK_POSTPONE_EVENT,
  SLACK_SILENCE_EVENT,
} = require("../settings");

const sqs = new AWS.SQS({ apiVersion: "2012-11-05" });

const db = require("../db");
const { Warnings } = db.models;

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
    const instance = await Warnings.getByInstanceID(id);
    if (!instance) {
      logger.error(`instance not found in database: ${id}`);
      return false;
    }

    switch (action) {
      case SLACK_POSTPONE_EVENT:
        await instance.postponeShutdown();
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
    return false;
  }
};

const processSqsMessage = async (err, data) => {
  if (err) {
    logger.error(err);
    return;
  }
  if (!data.Messages) return;

  logger.info(`Received ${data.Messages.length} messages from SQS`);
  data.Messages.map(async (msg) => {
    logger.info(`SQS message: ${JSON.stringify(msg)}`);

    const body = JSON.parse(msg.Body);
    const { action, instance_id: instanceId } = body;

    // sanintizing the input to prevent XSS attacks
    instanceId = sanitizer.sanitize(instanceId, "string");
    action = sanitizer.sanitize(action, "string");

    logger.info(`SQS info: instance id: ${instanceId}, action: ${action}`);
    let foundInstance = await handleSlackEvent(instanceId, action);

    if (foundInstance) {
      const deleteParams = {
        QueueUrl: SQS_QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle,
      };
      sqs.deleteMessage(deleteParams, function (err, data) {
        if (err) logger.error(`SQS Delete Error: ${err}`);
        else logger.info(`SQS Message deleted: ${JSON.stringify(data)}`);
      });
    }
  });
};

exports.pollSqsMessages = () => sqs.receiveMessage(params, processSqsMessage);

// exports.pollSqsMessages = async () => {
//   while (true) {
//     try {
//       const data = await sqs.receiveMessage(params).promise();
//       await processSqsMessage(data);
//     } catch (err) {
//       throw err;
//     }
//     await sleep(SQS_POLL_RATE);
//   }
// };
