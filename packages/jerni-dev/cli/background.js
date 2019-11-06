const { fork } = require("child_process");

exports.start = async function(file, ...args) {
  const worker = fork(file, args.map(obj => JSON.stringify(obj)));

  function kill() {
    worker.kill();
  }

  return new Promise((resolve, reject) => {
    function onMessage(msg) {
      if (msg.cmd === "ok") {
        resolve([msg.value, kill]);
        worker.removeListener("message", onMessage);
      } else if (msg.cmd === "error") {
        worker.kill();
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

  main();
};
