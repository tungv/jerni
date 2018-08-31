const path = require("path");

const { DEV_DIR } = require("./constants");
const getCollection = require("../utils/getCollection");
const normalizePulsesDatabase = require("./normalizePulsesDatabase");

module.exports = async () => {
  const { coll, db } = await getCollection(
    path.resolve(DEV_DIR, "pulses.json"),
    "pulses"
  );

  normalizePulsesDatabase(coll);
  db.saveDatabase();

  return { Pulses: coll, db };
};
