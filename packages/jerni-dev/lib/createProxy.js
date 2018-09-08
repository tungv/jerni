const colors = require("ansi-colors");

const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");

const { formatError } = require("./wrapError");
const { getDevFile } = require("../tasks/constants");
const { serializeStream, deserializeStream } = require("./proxy-stream");
const makeDefer = require("./makeDefer");

const createWorker = filepath => {
  return new Promise((resolve, reject) => {
    const worker = fork(path.resolve(__dirname, "./subscriber-process.js"), [
      filepath
    ]);

    const onMessage = msg => {
      if (msg.cmd === "ok") {
        resolve(worker);
        worker.removeListener("message", onMessage);
      } else if (msg.cmd === "error") {
        worker.kill();

        reject(new Error(formatError(msg)));

        worker.removeListener("message", onMessage);
      }
    };

    worker.on("message", onMessage);

    // ["error", "exit", "close", "disconnect"].forEach(evt => {
    //   worker.on(evt, (...args) => {
    //     console.log("-----", evt, ...args);
    //   });
    // });

    return worker;
  });
};

module.exports = async function createProxy(filepath, onChange) {
  let worker = await createWorker(filepath);

  let counter = 0;
  const defers = {};

  const simpleCall = methodName => (...args) => {
    const id = ++counter;
    const defer = makeDefer();
    defers[id] = defer;

    worker.send({ cmd: `simple call`, id, methodName, args });
    return defer.promise;
  };

  const proxy = {
    versions: simpleCall("versions"),
    DEV__getNewestVersion: simpleCall("DEV__getNewestVersion"),
    DEV__replaceWriteTo: simpleCall("DEV__replaceWriteTo"),
    DEV__cleanAll: simpleCall("DEV__cleanAll"),
    subscribe: async incoming$ => {
      const token = serializeStream(worker, ++counter, incoming$);
      const outgoingToken = await simpleCall("subscribe")(token);

      return deserializeStream(worker, outgoingToken);
    },
    destroy: () => {
      worker.kill();
    }
  };

  let reloading = false;

  const onMessage = async msg => {
    if (msg.cmd === "reload" && !reloading) {
      reloading = true;
      worker.removeListener("message", onMessage);

      try {
        const newWorker = await createWorker(filepath);
        const devServerUrl = String(
          fs.readFileSync(getDevFile("dev-server.txt"))
        );

        worker.kill();
        worker = newWorker;
        newWorker.on("message", onMessage);
        proxy.DEV__replaceWriteTo(devServerUrl);
        await onChange();
      } catch (ex) {
        worker.on("message", onMessage);
        console.error(
          `${colors.yellow(
            "WARNING"
          )}: cannot create new worker. Keep previous version\n`
        );
        console.error("  " + ex.message.split("\n").join("\n  "));
      } finally {
        reloading = false;
      }

      return;
    }

    if (msg.cmd === "simple call reply") {
      const defer = defers[msg.id];
      delete defers[msg.id];
      defer.resolve(msg.reply);
    }
  };

  worker.on("message", onMessage);

  return proxy;
};
