#!/usr/bin/env node
const sade = require("sade");
const { version, name } = require("../package.json");

const program = sade(name);

program.version(version);

program
  .command("start <path>", "start developing a new journey", { default: true })
  .option("http", "status reporting server port", 6181)
  .action((path, opts) => {
    process.env.NODE_ENV = "development";
    require("./dev-start")(path, opts).catch(ex => {
      console.error(ex);
      process.exit(1);
    });
  });

program.parse(process.argv);
