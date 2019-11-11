const { watch } = require("chokidar");
const path = require("path");
const debounce = require("debounce");
const getLogger = require("./dev-logger");

const { checksumFile, writeChecksum } = require("./fsQueue");
const { start } = require("./background");

const cwd = process.cwd();

module.exports = async function(filepath, opts) {
  let address, killServer, deps, stopJourney;
  const absolutePath = path.resolve(cwd, filepath);
  const logger = getLogger({ service: " cli ", verbose: opts.verbose });
  logger.info("jerni-dev.start");
  logger.info("source file: %s", absolutePath);
  logger.info("options %o", {
    http: opts.http,
    verbose: opts.verbose,
    dataPath: opts.dataPath,
  });

  const dataPath = opts.dataPath;

  const [current, original] = checksumFile(dataPath);
  await startServer({
    port: opts.http,
    dataPath,
    verbose: opts.verbose,
  });

  if (current !== original) {
    writeChecksum(dataPath, current);
  }

  await startJerni({ cleanStart: current !== original });

  // listen
  // watch data file
  onFileChange(dataPath, async () => {
    const [current, original] = checksumFile(dataPath);

    if (current === original) {
      logger.debug("organic change");
      return;
    }

    logger.warn("non-organic change detected!");
    logger.debug("  original checksum %s", original);
    logger.debug("   current checksum %s", current);

    logger.debug("stopping heq-server");
    killServer();

    logger.debug("stopping jerni");
    stopJourney();

    // rewrite checksum
    logger.debug("overwrite checksum with %s", current);
    writeChecksum(dataPath, current);

    await startJerni({ cleanStart: true });
    await startServer();
  });

  async function startServer() {
    logger.debug("starting heq-server…");
    const output = await start(path.resolve(__dirname, "./worker-heq-server"), {
      port: opts.http,
      dataPath,
      verbose: opts.verbose,
    });
    address = output[0];
    killServer = output[1];
    logger.info("heq-server is listening on port %d", address.port);
  }

  async function startJerni({ cleanStart }) {
    if (cleanStart) logger.info("clean start new journey");
    let output = await start(path.resolve(__dirname, "./worker-jerni"), {
      absolutePath,
      cleanStart,
      heqServerAddress: `http://localhost:${address.port}`,
      verbose: opts.verbose,
    });

    deps = output[0];
    stopJourney = output[1];
    logger.info("worker ready");

    logger.debug("watching %d files:", deps.length);
    deps.slice(0, 20).forEach((file, index) => {
      logger.debug("%d. %s", index + 1, path.relative(process.cwd(), file));
    });
    if (deps.length >= 20) {
      logger.debug("and %d more…", deps.length - 20);
    }

    const close = onFileChange(
      deps,
      debounce(async file => {
        logger.debug("file changed: %s", path.relative(process.cwd(), file));
        logger.info("hot reloading…");

        await close();
        stopJourney();

        startJerni({ cleanStart: true });
      }, 300),
    );
  }
};

function onFileChange(paths, handler) {
  const watcher = watch(paths);
  watcher.on("change", file => {
    handler(file);
  });

  return () => watcher.close();
}
