const { watch } = require("chokidar");
const path = require("path");
const fs = require("fs");
const debounce = require("debounce");
const getLogger = require("./dev-logger");

const { checksumFile, writeChecksum } = require("./fsQueue");
const { start } = require("./background");

const cwd = process.cwd();
const pkgDir = require("pkg-dir");
const { version } = require("../package.json");

const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "jerni-dev> ",
});

module.exports = async function(filepath, opts) {
  let address, stopServer, deps, stopJourney;
  const absolutePath = path.resolve(cwd, filepath);
  const rootDir = pkgDir.sync(cwd);
  const logger = getLogger({ service: " cli ", verbose: opts.verbose });
  logger.info("jerni-dev.start(%o)", { version });
  logger.info(" * source file: %s", absolutePath);
  logger.info(" * options %o", {
    http: opts.http,
    verbose: opts.verbose,
    dataPath: opts.dataPath,
  });

  rl.on("line", async line => {
    rl.pause();
    try {
      switch (line.trim()) {
        case "r":
          logger.info("you requested to reload.");
          await stopJourney();
          await stopServer();
          await startServer();
          await startJerni({ cleanStart: true });
          await sleep(100);
          break;
        default:
          console.log(`Say what? I might have heard '${line.trim()}'`);
          break;
      }
    } finally {
      rl.resume();
      rl.prompt();
    }
  }).on("close", () => {
    console.log("");
    logger.warn("interuptted! cleaning up…");
    cleanUp();
  });

  const dataPath = opts.dataPath;

  async function cleanUp() {
    if (stopServer) await stopServer();
    if (stopJourney) await stopJourney();
    logger.info("exiting…");
    process.exit(0);
  }
  process.on("SIGINT", () => {
    logger.warn("interuptted! cleaning up…");
    cleanUp();
  });

  process.on("uncaughtException", ex => {
    logger.error("Exception %s", ex.message);
    logger.error(ex.stack);
    cleanUp();
  });

  logger.info("checking integrity of data file since last start");
  const [current, original, events] = checksumFile(dataPath);
  if (current !== original) {
    logger.warn("non-organic changes detected");
  }

  await startServer();

  if (current !== original) {
    logger.info("re-enforce data file integrity");
    writeChecksum(dataPath, current);
  }

  await startJerni({ cleanStart: events.length === 0 || current !== original });
  await sleep(1000);
  rl.prompt();
  async function startServer() {
    if (isServerRunning) {
      logger.warn("server is running. Cannot start 2 instances of heq server");
      return;
    }
    logger.debug("starting heq-server…");
    isServerRunning = true;
    // start background process
    const [{ port }, stop] = await start(
      path.resolve(__dirname, "./worker-heq-server"),
      {
        port: opts.http,
        dataPath,
        verbose: opts.verbose,
      },
    );
    logger.info("heq-server is listening on port %d", port);

    // writing lockfile for journey.commit() to work in dev mode
    const lockfilePath = path.resolve(rootDir, ".jerni-dev");
    logger.info("writing lockfile to %s", path.relative(cwd, lockfilePath));
    fs.writeFileSync(lockfilePath, `http://localhost:${port}`);

    async function kill() {
      logger.debug("stopping heq-server subprocess…");
      await stop();
      logger.info("heq-server subprocess stopped!");

      logger.debug("removing lockfile at %s", lockfilePath);
      try {
        fs.unlinkSync(lockfilePath);
        logger.info("lockfile %s removed!", path.relative(cwd, lockfilePath));
      } catch {
        logger.warn("cannot unlink %s", lockfilePath);
      } finally {
        isServerRunning = false;
      }
    }

    // MUTATION: keep track of the current address
    address = `http://localhost:${port}`;
    stopServer = kill;

    // start watching
    // watch data file
    let corrupted = false;
    const stopWatching = onFileChange(dataPath, async () => {
      try {
        const [current, original] = checksumFile(dataPath);

        if (!corrupted && current === original) {
          logger.debug("organic change");
          return;
        }

        if (corrupted) {
          logger.info("attempt to recover from corrupted data file");
          corrupted = false;
        } else {
          logger.warn("non-organic change detected!");
          logger.debug("  original checksum %s", original);
          logger.debug("   current checksum %s", current);
        }

        logger.info("stop watching data file");
        stopWatching();

        logger.debug("stopping heq-server");
        await stopServer();

        logger.debug("stopping jerni");
        await stopJourney();

        // rewrite checksum
        logger.debug("overwrite checksum with %s", current);
        writeChecksum(dataPath, current);

        await startJerni({ cleanStart: true });
        await startServer();
      } catch (ex) {
        await stopServer();
        await stopJourney();
        corrupted = true;
        // process.exit(1);
      }
    });
  }

  async function startJerni({ cleanStart }) {
    if (isJourneyRunning) {
      logger.warn(
        "journey is running. Cannot start 2 instances at a same time",
      );
      return;
    }
    isJourneyRunning = true;
    if (cleanStart) logger.info("clean start new journey");
    let output = await start(path.resolve(__dirname, "./worker-jerni"), {
      absolutePath,
      cleanStart,
      heqServerAddress: address,
      verbose: opts.verbose,
    });

    deps = output[0];
    stopJourney = async function() {
      logger.debug("stopping jerni subprocess…");
      await output[1]();
      logger.info("jerni subprocess stopped!");
      close();
      logger.info("stopped watching journey source code!");
      isJourneyRunning = false;
    };
    logger.info("worker ready");

    logger.debug("watching %d files:", deps.length);
    deps.slice(0, 20).forEach((file, index) => {
      logger.debug("%d. %s", index + 1, path.relative(process.cwd(), file));
    });
    if (deps.length >= 20) {
      logger.debug("and %d more…", deps.length - 20);
    }

    const close = onFileChange(deps, async file => {
      logger.debug("file changed: %s", path.relative(process.cwd(), file));
      logger.info("hot reloading…");

      await close();
      await stopJourney();

      await startJerni({ cleanStart: true });
    });
  }
};

function onFileChange(paths, handler) {
  const watcher = watch(paths);
  let stopped = false;
  watcher.on(
    "change",
    debounce(file => {
      !stopped && handler(file);
    }, 300),
  );

  return () => {
    stopped = true;
    watcher.close();
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let isJourneyRunning = false;
let isServerRunning = false;
