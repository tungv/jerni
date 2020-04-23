const { createLogger, format, transports } = require("winston");
const { combine, printf, timestamp, splat } = format;

const myFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} ${level}: ${
    typeof message === "string" ? message : JSON.stringify(message)
  }`;
});

module.exports = (filename) =>
  createLogger({
    format: combine(timestamp(), splat(), myFormat),
    transports: [
      new transports.File({ filename: filename + "-err.log", level: "error" }),
      new transports.File({ filename: filename + "-info.log", level: "info" }),
    ],
  });
