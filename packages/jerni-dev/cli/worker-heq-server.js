const { wrap } = require("./background");
const makeFileSystemServer = require("./makeFileSystemServer");

module.exports = wrap(async function({ dataPath, port }) {
  const [server, restartNeeded] = await makeFileSystemServer({
    port,
    dataPath,
  });
  const address = server.address();
  console.log("server started at", address);

  restartNeeded.then(() => {
    process.exit(1);
  });

  return address;
});
