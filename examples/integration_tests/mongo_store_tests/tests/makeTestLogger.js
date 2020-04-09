function makeLogger(logLevel = makeLogger.LEVEL_DEBUG) {
  const logs = [];
  const record = (label, level) => (...args) => {
    if (level < logLevel) return;
    logs.push(label + require("util").format(...args));
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
