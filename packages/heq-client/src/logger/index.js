const LOG_LEVEL = {
  SILLY: 1,
  DEBUG: 2,
  INFO: 3,
  WARN: 4,
  ERROR: 5,
  FATAL: 6,
  DATA: 10,
};

let CURRENT_LOG_LEVEL;
let REPORTER = () => {};

export const setLogLevel = nextLevel => (CURRENT_LOG_LEVEL = nextLevel);
export const setReporter = reporter => (REPORTER = reporter);

export const shouldLog = level => {
  const minLogLevel = LOG_LEVEL[CURRENT_LOG_LEVEL];

  return LOG_LEVEL[level] >= minLogLevel;
};

export const write = (level, content) => {
  if (!shouldLog(level)) {
    return;
  }

  REPORTER(level, content);
};
