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
  for await (const output of journey.begin({ logger })) {
    logger.debug("output: %j", output);
  }
};

async function forkReportingServer(journey, opts) {
  try {
    const worker = await createReportServer(opts.http);

    for await (const report of journey.monitor({ interval: opts.interval })) {
      logger.info({
        label: "report",
        report,
      });

      worker.send({ label: "report", report });
    }
  } catch (err) {
    logger.debug("jerni failed to start report server. Reason: %s", err);
    process.exit(1);
  }
}

async function createReportServer(port) {
  const worker = fork(path.resolve(__dirname, "./background.js"), [
    String(port),
  ]);

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
          reject(msg.err);
        }
      }
    }
    worker.on("message", onMessage);
  });
}

// module.exports = async (filepath, opts) => {
//   console.log("MASTER: start");
//   console.time("MASTER: ready");
//   const latest = {
//     id: 0,
//     time: Date.now(),
//   };

//   const server = createServer((req, res) => {
//     res.statusCode = 200;
//     res.setHeader("content-type", "application/json");
//     res.end(JSON.stringify(latest));
//   });
//   server.listen(Number(opts.http), err => {
//     if (err) {
//       console.error(
//         "cannot start http server on port %s. Exitting...",
//         opts.http,
//       );
//       process.exit(1);
//       return;
//     }
//     console.log("monitoring server is listening on port", opts.http);
//   });

//   const worker = fork(path.resolve(__dirname, "./background.js"));

//   worker.on("message", msg => {
//     if (msg.cmd === "initial") {
//       console.timeEnd("MASTER: ready");
//       latest.id = msg.value;
//       latest.time = Date.now();
//       return;
//     }

//     if (msg.cmd === "reply") {
//       const stream$ = deserializeStream(worker, msg.token);

//       stream$.observe(
//         lastEvent => {
//           logger.info(`event #${lastEvent.id} ${lastEvent.type} has arrived`);

//           latest.id = lastEvent.id;
//           latest.time = Date.now();
//         },
//         err => {
//           logger.error(`unknown error ${err.name}`, err.stack);
//         },
//         () => {
//           logger.info(`subscription ends`);
//         },
//       );
//       return;
//     }
//   });

//   worker.send({ cmd: "start", filepath, opts });
// };
