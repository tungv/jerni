const micro = require("micro");
const factory = require("heq-server");
const inMemoryAdapter = require("heq-server/src/adapters/in-memory");

const makeServer = async ({ ns, port }) => {
  const queue = await inMemoryAdapter({
    ns: ns,
  });

  const service = await factory({});
  const server = micro(service);

  return new Promise((resolve, reject) => {
    server.listen(port, err => {
      if (err) {
        return reject(err);
      }

      return resolve({
        queue,
        server,
      });
    });
  });
};

module.exports = makeServer;
