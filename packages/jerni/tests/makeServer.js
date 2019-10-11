const micro = require("micro");
const factory = require("heq-server");
const inMemoryAdapter = require("heq-server/src/adapters/in-memory");
const enableDestroy = require("server-destroy");

const makeServer = async ({ ns, port, queue: existingQueue }) => {
  const queue =
    existingQueue ||
    (await inMemoryAdapter({
      ns: ns,
    }));

  const service = await factory({ queue });
  const server = micro(service);

  return new Promise((resolve, reject) => {
    server.listen(port, err => {
      if (err) {
        return reject(err);
      }

      enableDestroy(server);

      return resolve({
        queue,
        server,
      });
    });
  });
};

module.exports = makeServer;
