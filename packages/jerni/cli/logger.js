const { createLogger, format, transports } = require("winston");
const { combine, timestamp, json, printf, splat } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${level}: ${
    typeof message === "string" ? message : JSON.stringify(message)
  }`;
});

const logger = createLogger({
  format: combine(timestamp(), json()),
  transports: [
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combined.log", level: "info" }),
  ],
});

module.exports = logger;

logger.console = new transports.Console({
  level: "debug",
  format: combine(splat(), myFormat),
});
