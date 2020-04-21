function makeLogger(logLevel = makeLogger.LEVEL_DEBUG, masked = true) {
  const logs = [];
  const record = (label, level) => (...args) => {
    if (level < logLevel) return;

    let fmt = require("util").format(...args);

    if (masked) {
      fmt = fmt
        .replace(/at (.*) \(.*\)/g, "at $1 (**)")
        .replace(/at \/.*/g, "at <anonymous> (**)");
    }

    logs.push(label + fmt);
  };
  const logger = {
    debug: record("[DBG] ", makeLogger.LEVEL_DEBUG),
    log: record("[LOG] ", makeLogger.LEVEL_LOG),
    info: record("[INF] ", makeLogger.LEVEL_INFO),
    error: record("[ERR] ", makeLogger.LEVEL_ERROR),
  };

  return [logger, logs];
}

makeLogger.LEVEL_DEBUG = 0;
makeLogger.LEVEL_LOG = 1;
makeLogger.LEVEL_INFO = 2;
makeLogger.LEVEL_ERROR = 3;

module.exports = makeLogger;
