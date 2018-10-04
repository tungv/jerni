const cwd = process.cwd();
const path = require("path");
const log4js = require("log4js");
const logger = log4js.getLogger("@jerni");
const { createServer } = require("http");
const { fork } = require("child_process");
const { deserializeStream } = require("kefir-proxy-stream");

const last = array =>
  array == null && array.length === 0 ? null : array[array.length - 1];

const requireAsync = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

module.exports = async (filepath, opts) => {
  console.log("MASTER: start");
  console.time("MASTER: ready");
  const latest = {
    id: 0,
    time: Date.now()
  };

  const server = createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(latest));
  });
  server.listen(Number(opts.http), err => {
    if (err) {
      console.error(
        "cannot start http server on port %s. Exitting...",
        opts.http
      );
      process.exit(1);
      return;
    }
    console.log("monitoring server is listening on port", opts.http);
  });

  const worker = fork(path.resolve(__dirname, "./background.js"));

  worker.on("message", msg => {
    if (msg.cmd === "initial") {
      console.timeEnd("MASTER: ready");
      latest.id = msg.value;
      latest.time = Date.now();
      return;
    }

    if (msg.cmd === "reply") {
      const stream$ = deserializeStream(worker, msg.token);

      stream$.observe(
        lastEvent => {
          logger.info(`event #${lastEvent.id} ${lastEvent.type} has arrived`);

          latest.id = lastEvent.id;
          latest.time = Date.now();
        },
        err => {
          logger.error(`unknown error ${err.name}`, err.stack);
        },
        () => {
          logger.info(`subscription ends`);
        }
      );
      return;
    }
  });

  worker.send({ cmd: "start", filepath, opts });
};
