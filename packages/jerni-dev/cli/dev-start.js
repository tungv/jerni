const { watch } = require("chokidar");
const path = require("path");
const getLogger = require("./dev-logger");

const { checksumFile, writeChecksum } = require("./fsQueue");
const { start } = require("./background");

const cwd = process.cwd();

const DATAPATH = "./.eventsrc";

module.exports = async function(filepath, opts) {
  const absolutePath = path.resolve(cwd, filepath);
  const essentialOpts = { http: opts.http, verbose: opts.verbose };
  const logger = getLogger({ service: " cli ", verbose: opts.verbose });
  logger.info('jerni-dev.start("%s", %j)', absolutePath, essentialOpts);

  const [current, original] = checksumFile(DATAPATH);
  let [address, killServer] = await startServer({
    port: 9999,
    dataPath: DATAPATH,
    verbose: opts.verbose,
  });

  if (current !== original) {
    writeChecksum(DATAPATH, current);
  }

  let [deps, stopJourney] = await start(
    path.resolve(__dirname, "./worker-jerni"),
    {
      absolutePath,
      cleanStart: current !== original,
      heqServerAddress: `http://localhost:${address.port}`,
      verbose: opts.verbose,
    },
  );

  logger.info("worker ready", deps);

  // listen
  // watch data file
  onFileChange(DATAPATH, async () => {
    const [current, original] = checksumFile(DATAPATH);

    if (current === original) {
      logger.debug("organic change");
      return;
    }

    logger.info("non-organic change");
    logger.debug("  original checksum %s", original);
    logger.debug("   current checksum %s", current);

    logger.debug("stopping heq-server");
    killServer();

    logger.debug("stopping jerni");
    stopJourney();

    // rewrite checksum
    logger.debug("overwrite checksum with %s", current);
    writeChecksum(DATAPATH, current);

    logger.info("clean start new journey");
    let _2 = await start(path.resolve(__dirname, "./worker-jerni"), {
      absolutePath,
      cleanStart: true,
      heqServerAddress: `http://localhost:${address.port}`,
    });

    deps = _2[0];
    stopJourney = _2[1];
    logger.debug("worker ready", deps);

    const _1 = await startServer({ port: 9999, dataPath: DATAPATH });
    address = _1[0];
    killServer = _1[1];
  });

  async function startServer({ port, dataPath, verbose }) {
    logger.debug("starting heq-server…");
    const [address, killServer] = await start(
      path.resolve(__dirname, "./worker-heq-server"),
      { port, dataPath, verbose },
    );
    logger.info("heq-server is listening on port %d", address.port);

    return [address, killServer];
  }
};

function onFileChange(paths, handler) {
  const watcher = watch(paths);
  watcher.on("change", file => {
    handler(file);
  });
}
