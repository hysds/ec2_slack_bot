const express = require("express");
const cron = require("node-cron");
const aws = require("aws-sdk");

const { logger } = require("./logger");

const {
  AWS_REGION,
  TAG_FILTERS,
  CRON_TAB_SETTINGS,
  USE_SQS,
  SQS_POLL_RATE
} = require("./settings");

const { InstanceAnalyzer } = require("./InstanceAnalyzer");
const instanceAnalyzer = new InstanceAnalyzer(aws, AWS_REGION);

const { pollSqsMessages } = require("./sqs/message_receiver");

// polling SQS every X seconds to process data from Lambda
if (USE_SQS) setInterval(() => pollSqsMessages(), SQS_POLL_RATE);

// instanceAnalyzer.checkInstances(TAG_FILTERS);
cron.schedule(CRON_TAB_SETTINGS, () =>
  instanceAnalyzer.checkInstances(TAG_FILTERS)
);

app = express();

// app.use("/api/warnings", require("./routes/api/warnings"));
app.use("/api/slack", require("./routes/api/slack"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server started on port ${PORT}!`));
