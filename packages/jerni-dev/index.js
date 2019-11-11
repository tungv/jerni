const fs = require("fs");

exports.getDevServerUrl = async function() {
  const portAsString = String(fs.readFileSync(".jerni-dev"));
  return Number.parseInt(portAsString, 10);
};
