const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");

const db = require("../../db");
const { Warnings } = db.models;

const { serviceLogger } = require("../../logger");

router.use(serviceLogger);

router.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
router.use(bodyParser.json()); // parse application/json

router.get("/get-instances/:instance_id", async (req, res) => {
  const id = req.params.instance_id;
  try {
    const instanceWarning = await Warnings.getByInstanceID(id);
    res.json(instanceWarning.dataValues);
  } catch (err) {
    res.status(404).send({ message: `instance not found: ${id}` });
  }
});

router.get("/get-instances", async (_, res) => {
  try {
    const instances = await Warnings.findAll();
    if (!instances) {
      res.status(404).send({ message: "No instances founnd in database" });
    }
    res.json(instances);
  } catch (err) {
    res.status(500).send({ message: `Error: ${err}` });
  }
});

module.exports = router;
