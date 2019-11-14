#!/usr/bin/env node
const sade = require("sade");
const logger = require("./logger");
const { version, name } = require("../package.json");

const program = sade(name);

program.version(version);

program
  .command("start <path>", "start a new journey", { default: true })
  .option("interval", "logging interval", 5 * 60 * 1000)
  .option("http", "status reporting server port", 6181)
  .option("verbose", "enable debug log to console", true)
  .action((path, opts) => {
    if (opts.verbose) {
      logger.add(logger.console);
    }
    process.env.NODE_ENV = "production";
    logger.debug("cli.start(%o)", {
      version,
      interval: opts.interval,
      http: opts.http,
      verbose: opts.verbose,
    });
    require("./jerni-start")(path, opts);
  });

program.parse(process.argv);
