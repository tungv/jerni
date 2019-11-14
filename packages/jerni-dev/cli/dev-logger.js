module.exports = function getLogger({ service, verbose }) {
  const { createLogger, format, transports } = require("winston");
  const { combine, colorize, json, printf, splat } = format;

  const myFormat = printf(({ level, message, label }) => {
    return `[${service}] ${level}: ${
      typeof message === "string"
        ? message
        : require("util").inspect(message, { depth: 3, colors: true })
    }`;
  });

  const logger = createLogger({
    transports: [
      new transports.Console({
        level: verbose ? "debug" : "info",
        format: combine(colorize(), json(), splat(), myFormat),
        service: "worker-jerni",
      }),
    ],
  });

  return logger;
};
