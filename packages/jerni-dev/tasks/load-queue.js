const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");

const { NAMESPACE, DEV_DIR } = require("./constants");

module.exports = async () => {
  if (!fs.existsSync(DEV_DIR)) {
    mkdirp.sync(DEV_DIR);
  }
  const adapter = require("@heq/server-lokijs");
  return adapter({
    ns: NAMESPACE,
    filepath: path.resolve(DEV_DIR, "events.json")
  });
};
