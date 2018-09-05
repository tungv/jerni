#!/usr/bin/env node
const sade = require("sade");

const path = require("path");

const { version, name } = require("../package.json");

const program = sade(name);

program.version(version);

program
  .command("start <path>", "start a new journey", { default: true })
  .action((path, opts) => {
    process.env.NODE_ENV = "production";
    require("./jerni-start")(path, opts);
  });

program.parse(process.argv);
