const { makeQueue } = require("./fsQueue");

const micro = require("micro");
const factory = require("heq-server");

module.exports = async function makeFileSystemServer({
  port,
  dataPath,
  verbose,
}) {
  const queue = await makeQueue(dataPath, verbose);

  const config = {
    queue,
  };

  const service = await factory(config);
  const server = micro(service);

  return new Promise((resolve, reject) => {
    server.listen(port, err => {
      if (!err) {
        resolve(server);
        return;
      }

      reject(err);
    });
  });
};
