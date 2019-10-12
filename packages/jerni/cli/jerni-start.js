const cwd = process.cwd();
const path = require("path");
const { fork } = require("child_process");

const requireAsync = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

const logger = require("./logger");

module.exports = async function startJerniJob(filepath, opts) {
  const absolutePath = path.resolve(cwd, filepath);
  logger.debug("filepath %s", absolutePath);

  const initializer = await requireAsync(absolutePath);

  const journey =
    typeof initializer === "function" ? await initializer() : initializer;

  forkReportingServer(journey, opts);

  logger.debug("journey.begin()");
  for await (const output of journey.begin({ logger, pulseTime: 10 })) {
    logger.debug("output: %j", output);
  }
};

async function forkReportingServer(journey, opts) {
  const worker = await createReportServer(opts.http);
  try {
    for await (const report of journey.monitor({ interval: opts.interval })) {
      logger.info({
        label: "report",
        report,
      });

      worker.send({ label: "report", report });
    }
  } catch (err) {
    logger.debug("jerni failed to start report server. Reason: %o", err);
    worker.kill();
    process.exit(1);
  }
}

async function createReportServer(port) {
  const worker = fork(path.resolve(__dirname, "./background.js"), [
    String(port),
  ]);

  process.on("SIGINT", function() {
    logger.info("terminated");
    worker.kill();
    process.exit(0);
  });

  return new Promise((resolve, reject) => {
    function onMessage(msg) {
      if (typeof msg.ok === "boolean") {
        worker.off("message", onMessage);
        if (msg.ok) {
          logger.info({
            label: "report-server-started",
            address: msg.address,
          });
          resolve(worker);
        } else {
          logger.error({
            label: "report-server-failed",
            error: msg.err,
          });
          worker.kill();
          reject(msg.err);
        }
      }
    }
    worker.on("message", onMessage);
  });
}
