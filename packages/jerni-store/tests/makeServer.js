const adapter = require('@heq/server-lokijs');
const micro = require('micro');
const factory = require('heq-server');

const makeServer = async ({ ns, port }) => {
  const queue = await adapter({
    ns: ns,
  });

  const service = await factory({ queue });
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
