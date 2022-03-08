const express = require("express");
const cron = require("node-cron");

const db = require("./db");
const { logger } = require("./logger");

const {
  AWS_REGION,
  TAG_FILTERS,
  CRON_TAB_SETTINGS,
  USE_SQS,
  SQS_POLL_RATE,
} = require("./settings");

db.initialize();

const { InstanceAnalyzer } = require("./InstanceAnalyzer");
const { pollSqsMessages } = require("./sqs");

const instanceAnalyzer = new InstanceAnalyzer(AWS_REGION);

// polling SQS every X seconds to process data from Lambda
if (USE_SQS) setInterval(() => pollSqsMessages(), SQS_POLL_RATE);

(async () => await instanceAnalyzer.checkInstances(TAG_FILTERS))();
// cron.schedule(
//   CRON_TAB_SETTINGS,
//   async () => await instanceAnalyzer.checkInstances(TAG_FILTERS)
// );

app = express();
app.use("/api/slack", require("./routes/api/slack"));
app.use("/api/warnings", require("./routes/api/warnings"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server started on port ${PORT}!`));
