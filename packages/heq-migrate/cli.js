#!/usr/bin/env node
const sade = require("sade");
const path = require("path");
const fs = require("fs");
const ProgressBar = require("progress");

const migrate = require("./src/migrate");
const getLogger = require("./logger");

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
    const cwd = process.cwd();
    const logger =
      process.env.NODE_ENV === "test" ? console : getLogger("heq-migrate");

    const transform = options.transform
      ? safelyResolveTransformFunction(path.resolve(cwd, options.transform))
      : (x) => x;

    const progressFile = path.resolve(cwd, options.progress);
    const progress = safelyLoadProgressFile();
    let bar;
    try {
      for await (const [complete, total] of migrate(fromAddress, toAddress, {
        logger,
        progress,
        transform,
        pulseCount: options.pulseCount,
      })) {
        if (!bar) {
          console.error("");
          bar = new ProgressBar(
            "MIGRATING [:bar] :rate events/second :percent :etas",
            { total, width: 30, complete: "=", incomplete: " " },
          );
        }
        bar.update(complete / total);
      }

      fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));

      process.exit(0);
    } catch (ex) {
      logger.error("Failed to migrate with error: %s", ex.message);
      process.exit(2);
    }

    function safelyResolveTransformFunction(transformFile) {
      try {
        logger.info("transform filepath: %s", transformFile);
        const transformFn = require(transformFile);
        return transformFn.default || transformFn;
      } catch (ex) {
        logger.error("cannot resolve transform function from file");
        logger.error("error", ex.message);
        process.exit(1);
      }
    }

    function safelyLoadProgressFile() {
      try {
        logger.info("progress filepath: %s", progressFile);
        if (!fs.existsSync(progressFile)) {
          logger.info(
            "no progress file found. heq-migrate will attempt to migrate from scratch",
          );
          return {};
        }

        const fileContent = String(fs.readFileSync(progressFile));

        const progress = JSON.parse(fileContent);
        return progress;
      } catch (ex) {
        logger.error("Corrupted progress file");
        logger.debug("parse error:", ex.message);
      }
    }
  });

program.parse(process.argv);
