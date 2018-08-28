const { fork } = require("child_process");
const makeDefer = require("./makeDefer");
const kefir = require("kefir");
const path = require("path");
const { serializeStream, deserializeStream } = require("./proxy-stream");

module.exports = async function createProxy(filepath) {
  const worker = fork(path.resolve(__dirname, "./subscriber-process.js"), [
    filepath
  ]);

  let counter = 0;
  const defers = {};

  const simpleCall = methodName => (...args) => {
    const id = ++counter;
    const defer = makeDefer();
    defers[id] = defer;
    console.time(`master:: simpleCall ${methodName}`);
    worker.send({ cmd: `simple call`, id, methodName, args });
    return defer.promise.then(reply => {
      console.timeEnd(`master:: simpleCall ${methodName}`);

      return reply;
    });
  };

  worker.on("exit", () => {
    console.log("exitted");
  });

  worker.on("message", msg => {
    if (msg.cmd === "simple call reply") {
      const defer = defers[msg.id];
      delete defers[msg.id];
      defer.resolve(msg.reply);
    }
  });

  return {
    DEV__getNewestVersion: simpleCall("DEV__getNewestVersion"),
    DEV__replaceWriteTo: simpleCall("DEV__replaceWriteTo"),
    DEV__cleanAll: simpleCall("DEV__cleanAll"),
    subscribe: async incoming$ => {
      const token = serializeStream(worker, ++counter, incoming$);
      const outgoingToken = await simpleCall("subscribe")(token);

      return deserializeStream(worker, outgoingToken);
    }
  };
};
