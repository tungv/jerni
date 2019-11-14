const { wrap } = require("./background");
const makeFileSystemServer = require("./makeFileSystemServer");

module.exports = wrap(async function({ dataPath, port, verbose }) {
  const server = await makeFileSystemServer({
    port,
    dataPath,
    verbose,
  });
  const address = server.address();
  return address;
});
