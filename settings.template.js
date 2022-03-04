module.exports = {
  // cron tab settings (https://crontab.guru/)
  CRON_TAB_SETTINGS: "*/5 * * * *",

  // aws configurations
  AWS_REGION: "us-west-2",
  // will not run any actions if instance has these tags
  WHITE_LIST_FILTERS: [
    // { Key: "Owner", Value: "test@email.com" },
    { Key: "Owner", Value: "AutoScaling" },
  ],
  // filters for ec2 instances
  TAG_FILTERS: [{ key: "Bravo", value: "pcm" }],

  // database settings
  DB_TYPE: "sqlite", // sqlite, mysql, postgresql
  DB_NAME: "testdb.db",
  DB_USERNAME: null,
  DB_PASSWORD: null,
  DB_PORT: 5432,
  DB_LOCATION: "/path/to/sqlite/sqlite.db", // sqlite only

  // production mode (set to true shut down instance, false for dry-run)
  PRODUCTION_MODE: false,

  // slack configs
  SLACK_TOKEN: "",
  SLACK_CHANNEL_ID: "",
  SLACK_SIGNING_SECRET: "",

  // slack event names
  SLACK_POSTPONE_EVENT: "postpone",
  SLACK_SILENCE_EVENT: "silence",

  // list of all timezones: https://docs.oracle.com/middleware/12211/wcs/tag-ref/MISC/TimeZones.html
  TIMEZONE: "America/Los_Angeles",

  // INSTANCE_TIME_LIMIT: 10, // (HOURS) time limit instance have been running before we start warning slack
  INSTANCE_TIME_LIMIT: 10,
  MAX_WARNINGS: 3, // number of warnings until instance shuts down

  // SQS options
  USE_SQS: true,
  SQS_POLL_RATE: 60000, // 1000 miliseconds per second
  SQS_QUEUE_URL: "",

  // log directory (winston package will cycle new log file everyday)
  LOG_DIR: "/path/to/log/directory",

  DEBUG: true,
};
