#!/usr/bin/env node
const sade = require("sade");
const program = sade("heq-dev");

const { version } = require("./package.json");

program.version(version).option("banner", "BANNER FTW", false);

const { HEQ_PORT = "8080" } = process.env;

program
  .command(
    "subscribe <path>",
    "subscribe to a heq-store instance with an integrated heq-server",
    { default: true }
  )
  .option("port", "http port to listen", Number.parseInt(HEQ_PORT, 10))
  .option("force", "try it best to start a server", false)
  .action((path, opts) => {
    if (opts.banner) {
      require("./banner");
    }

    require("./subscribe-dev")(path, opts);
  });

program.parse(process.argv);
