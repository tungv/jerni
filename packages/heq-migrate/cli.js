#!/usr/bin/env node
const sade = require("sade");

const program = sade("heq-migrate");
const { version } = require("./package.json");

program.version(version);

program
  .command(
    "migrate <src> <dest>",
    "migrate events from one heq-server to another",
    { default: true },
  )
  .option(
    "--transform",
    "specify custom transformation, including filtering, modification and replacement",
  )
  .option("--pulseCount", "number of events for each batch of processing", 200)
  .option(
    "--progress",
    "progress storing filepath",
    "heq-migrate-progress.json",
  )
  .example("migrate https://some-server.com https://destination-server.com")
  .example(
    "migrate https://some-server.com https://destination-server.com --transform=transform.js",
  )
  .example(
    "migrate https://some-server.com https://destination-server.com --pulseCount=1000",
  )
  .action(async function (fromAddress, toAddress, options) {
    console.log(fromAddress, toAddress, options);
  });

program.parse(process.argv);
