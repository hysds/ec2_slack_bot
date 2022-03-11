const { createHmac } = require("crypto");
const moment = require("moment-timezone");

const { TIMEZONE } = require("./settings");

/**
 * get the time difference (in hrs) between 2 timestamps
 * @param {Date} launch
 * @returns {Number}
 */
exports.hoursDiff = (launch) => {
  const now = moment().utc();
  const launchTime = moment(launch).utc();
  return moment.duration(now.diff(launchTime)).asHours();
};

/**
 * Async/await style sleep function, similar to python's time.sleep()
 * @async
 * @param {Number} ms
 * @returns {Promise}
 */
exports.sleep = (ms = 750) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * return the tag value
 * @param {Array.<Object>} tags - instance tags
 * @returns {String|null}
 */
exports.getTagValueByKey = (tags, key) => {
  const obj = tags.find((e) => e.Key === key);
  return obj ? obj.Value : null;
};

/**
 * return the "Owner" tag value
 * @param {Array.<Object>} tags - instance tags
 * @returns {String|null}
 */
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
 * check https://en.wikipedia.org/wiki/List_of_tz_database_time_zones or list of timezones
 * @param {String} tz - timezone, ex. America/Los_Angeles
 * @returns
 */
exports.checkWorkHours = (tz = null) => {
  tz = tz || TIMEZONE;
  const now = moment().utc().tz(tz);
  const day = now.day();
  const hour = now.hour();
  if (day > 0 && day < 6 && hour > 7 && hour < 18) return true; // 8am - 7pm weekdays
  return false;
};

/**
 * O(N) list comparison of tags to list of white listed tags
 *     ex. [{ Key: 'Bravo', Value: 'adt' }...]
 * @param {Array.<Object>} tags - list of instance tags
 * @param {Array.<Object>} whitelist - list of whitelisted tags
 * @returns {Boolean}
 */
exports.checkWhitelist = (tags, whitelist) => {
  const _tags = tags.map((t) => JSON.stringify(t)); // object vs string comparison: O(N^2) -> O(N)
  const _whitelist = new Set(whitelist.map((t) => JSON.stringify(t)));
  const hasTag = _tags.find((t) => _whitelist.has(t)); // .find() returns undefined if not found
  return hasTag !== undefined;
};

/**
 * https://api.slack.com/authentication/verifying-requests-from-slack
 * @param {String} signingSecret - signing secret provided by slack
 * @param {String} reqBody
 * @param {Object} headers - request headers
 * @returns {String}
 */
exports.createSignature = (signingSecret, reqBody, headers) => {
  const timestamp = headers["x-slack-request-timestamp"];
  const sigBasestring = "v0:" + timestamp + ":" + reqBody;
  const hash = createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex");
  return `v0=${hash}`;
};
