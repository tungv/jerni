#!/usr/bin/env node
const sade = require("sade");

const path = require("path");

const { version } = require("./package.json");

const program = sade("jerni-dev");

program.version(version);

const { HEQ_PORT = "8080" } = process.env;

program
  .command(
    "start <path>",
    "start to a heq-store instance with an integrated heq-server",
    { default: true }
  )
  .option("port", "http port to listen", Number.parseInt(HEQ_PORT, 10))
  .option("force", "try it best to start a server", false)
  .option("open", "open web UI after initializing", false)
  .action((path, opts) => {
    require("./subscribe-dev")(path, opts);
  });

program.command("clean <journey>", "clean").action(filepath => {
  require("./clean")(filepath);
});

program
  .command("inspect <journey>")
  .action(filepath => require("./inspectCmd")(filepath));

program.parse(process.argv);
