const { createLogger, format, transports } = require("winston");
const { combine, timestamp, json, printf, splat } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${level}: ${
    typeof message === "string" ? message : JSON.stringify(message)
  }`;
});

const logger = createLogger({
  level: "debug",
  format: combine(timestamp(), json()),
  defaultMeta: { service: "jerni" },
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combined.log", level: "info" }),
  ],
});

module.exports = logger;

logger.console = new transports.Console({
  level: "debug",
  format: combine(splat(), myFormat),
});
