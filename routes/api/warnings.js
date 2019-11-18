const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");

const { InstanceWarningModel } = require("../../sequelize/models");

const aws = require("aws-sdk");
const { AWS_REGION } = require("../../settings");
aws.config.region = AWS_REGION;

const { serviceLogger } = require("../../logger");

router.use(serviceLogger);

router.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
router.use(bodyParser.json()); // parse application/json

router.get("/get-instances/:instance_id", async (req, res) => {
  const id = req.params.instance_id;
  try {
    instanceWarning = await InstanceWarningModel.getByInstanceID(id);
    res.json(instanceWarning.dataValues);
  } catch (err) {
    res.status(404).send({ message: `instance not found: ${id}` });
  }
});

router.get("/get-instances", async (req, res) => {
  try {
    const instances = await InstanceWarningModel.findAll();
    if (!instances) {
      res.status(404).send({ message: "No instances founnd in database" });
    }
    res.json(instances);
  } catch (err) {
    res.status(500).send({ message: "INTERNAL SERVER ERROR" });
  }
});

module.exports = router;
