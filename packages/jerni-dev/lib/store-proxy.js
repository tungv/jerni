const { fork } = require("child_process");
const path = require("path");

const { serializeStream, deserializeStream } = require("./proxy-stream");
const makeDefer = require("./makeDefer");

module.exports = function createProxy(filepath) {
  return new Promise((resolve, reject) => {
    const worker = fork(path.resolve(__dirname, "./subscriber-process.js"), [
      filepath
    ]);

    ["error", "exit", "close", "disconnect"].forEach(evt => {
      worker.on(evt, (...args) => {
        console.log("-----", evt, ...args);
      });
    });

    let counter = 0;
    const defers = {};

    const simpleCall = methodName => (...args) => {
      const id = ++counter;
      const defer = makeDefer();
      defers[id] = defer;

      worker.send({ cmd: `simple call`, id, methodName, args });
      return defer.promise;
    };

    worker.on("message", msg => {
      if (msg.cmd === "ok") {
        resolve({
          DEV__getNewestVersion: simpleCall("DEV__getNewestVersion"),
          DEV__replaceWriteTo: simpleCall("DEV__replaceWriteTo"),
          DEV__cleanAll: simpleCall("DEV__cleanAll"),
          subscribe: async incoming$ => {
            const token = serializeStream(worker, ++counter, incoming$);
            const outgoingToken = await simpleCall("subscribe")(token);

            return deserializeStream(worker, outgoingToken);
          }
        });
        return;
      }
      if (msg.cmd === "error") {
        worker.kill();
        const err = new Error(msg.message);
        reject(err);
        return;
      }
      if (msg.cmd === "simple call reply") {
        const defer = defers[msg.id];
        delete defers[msg.id];
        defer.resolve(msg.reply);
      }
    });
  });
};
