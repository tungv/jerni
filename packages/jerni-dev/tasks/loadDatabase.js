const getPulses = require("../utils/getPulses");
const normalizePulsesDatabase = require("./normalizePulsesDatabase");

module.exports = async () => {
  const { coll, db } = await getPulses();

  normalizePulsesDatabase(coll);
  db.saveDatabase();

  return { Pulses: coll, db };
};
