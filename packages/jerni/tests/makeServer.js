const micro = require("micro");
const factory = require("heq-server");
const inMemoryAdapter = require("heq-server/src/adapters/in-memory");
const enableDestroy = require("server-destroy");

const servers = [];

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
      servers.push(server);

      return resolve({
        queue,
        server,
      });
    });
  });
};

afterAll(() => {
  // close all
  servers.forEach(svr => {
    svr.close();
    svr.destroy();
  });
  servers.length = 0;
});

module.exports = makeServer;
