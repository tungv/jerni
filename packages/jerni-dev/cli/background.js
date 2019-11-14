const { fork } = require("child_process");

let workers = [];

process.on("exit", () => {
  workers.forEach(worker => {
    if (!worker.connected) {
      worker.send("kill");
    }
  });
});

exports.start = async function(file, ...args) {
  const worker = fork(file, args.map(obj => JSON.stringify(obj)));

  async function kill() {
    if (!worker.connected) {
      console.warn("worker not connected");
      workers = workers.filter(w => w !== worker);
      return;
    }
    // console.log("sending kill");
    worker.send("kill");

    return new Promise(resolve => {
      worker.on("close", () => {
        workers = workers.filter(w => w !== worker);
        resolve();
      });
    });
  }

  return new Promise((resolve, reject) => {
    function onMessage(msg) {
      if (msg.cmd === "ok") {
        resolve([msg.value, kill]);
      } else if (msg.cmd === "error") {
        worker.send("kill");
        reject(new Error(msg.error));

        worker.removeListener("message", onMessage);
      }
    }

    worker.on("message", onMessage);
  });
};

exports.wrap = function(fn) {
  async function main() {
    try {
      const args = process.argv.slice(2).map(json => JSON.parse(json));
      const output = await fn(...args);
      process.send({
        cmd: "ok",
        value: output,
      });
    } catch (ex) {
      console.error(ex);
      process.send({
        cmd: "error",
        error: ex,
      });
      process.exit(ex.code || 1);
    }
  }

  process.once("message", function(msg) {
    if (msg === "kill") {
      process.exit();
    }
  });

  main();
};
