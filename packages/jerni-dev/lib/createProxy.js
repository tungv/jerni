const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");

const { serializeStream, deserializeStream } = require("./proxy-stream");
const makeDefer = require("./makeDefer");

const DEV_DIR = path.resolve(process.cwd(), "./.jerni-dev");

module.exports = function createProxy(filepath, onChange) {
  const createWorker = () => {
    const worker = fork(path.resolve(__dirname, "./subscriber-process.js"), [
      filepath
    ]);

    // ["error", "exit", "close", "disconnect"].forEach(evt => {
    //   worker.on(evt, (...args) => {
    //     console.log("-----", evt, ...args);
    //   });
    // });

    return worker;
  };
  return new Promise((resolve, reject) => {
    let worker = createWorker();

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

    // initial
    worker.once("message", msg => {
      if (msg.cmd === "ok") {
        resolve(proxy);
        return;
      }
      if (msg.cmd === "error") {
        worker.kill();
        const err = new Error(msg.message);
        reject(err);
        return;
      }
    });

    const onMessage = msg => {
      if (msg.cmd === "reload") {
        worker.removeListener("message", onMessage);
        worker.kill();
        worker = createWorker();
        const devServerUrl = String(
          fs.readFileSync(path.resolve(DEV_DIR, "dev-server.txt"))
        );
        proxy.DEV__replaceWriteTo(devServerUrl);
        worker.on("message", onMessage);
        onChange();
        return;
      }
      if (msg.cmd === "simple call reply") {
        const defer = defers[msg.id];
        delete defers[msg.id];
        defer.resolve(msg.reply);
      }
    };

    worker.on("message", onMessage);
  });
};
