const micro = require("micro");
const factory = require("../src/factory");

module.exports = async function createServer(port, ns = "__test__") {
  const config = {
    http: { port },
  };

  if (process.env.REDIS_E2E) {
    const { execSync } = require("child_process");

    execSync(`redis-cli -n 2 del {${ns}}::id {${ns}}::events`);

    config.queue = {
      driver: "@heq/server-redis",
      url: "redis://localhost:6379/2",
      ns,
    };
  }

  const service = await factory(config);

  const server = micro(service);
  return new Promise(resolve => {
    server.listen(port, err => {
      resolve(server);
    });
  });
};
