const { DEV_DIR } = require("../tasks/constants");
const getCollection = require("./getCollection");
const path = require("path");

let coll;

module.exports = async function getPulse() {
  if (!coll) {
    coll = await getCollection(path.resolve(DEV_DIR, "pulses.json"), "pulses");
  }

  return coll;
};
