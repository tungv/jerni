const path = require("path");
const { start } = require("./background");

const cwd = process.cwd();

module.exports = async function(filepath, opts) {
  const absolutePath = path.resolve(cwd, filepath);
  console.debug("journey initializer filepath", absolutePath);

  const [address, killServer] = await start(
    path.resolve(__dirname, "./worker-heq-server"),
    { port: 9999, dataPath: "./.events.dat" },
  );

  const [deps, kill] = await start(path.resolve(__dirname, "./worker-jerni"), {
    absolutePath,
    heqServerAddress: `http://localhost:${address.port}`,
  });
  console.log("worker ready", deps);

  // await sleep(1000);
  // kill();
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
