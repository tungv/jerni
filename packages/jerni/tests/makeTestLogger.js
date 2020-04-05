module.exports = function makeLogger() {
  const logs = [];
  const record = level => (...args) => {
    logs.push(level + require("util").format(...args));
  };
  const logger = {
    log: record("[LOG] "),
    info: record("[INF] "),
    error: record("[ERR] "),
    debug: record("[DBG] "),
  };

  return [logger, logs];
};
