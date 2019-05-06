const micro = require("micro");
const factory = require("../src/factory");

module.exports = async function createServer(port, ns = "__test__") {
  const config = {
    http: { port },
  };

  if (process.env.REDIS_E2E) {
    const { execSync } = require("child_process");

    const keys = String(execSync(`redis-cli -n 2 keys {${ns}}::*`)).split("\n");
    execSync(`redis-cli -n 2 del ${keys.join(" ")}`);

    const adapter = require("@heq/server-redis");
    config.queue = await adapter({
      url: "redis://localhost:6379/2",
      ns,
    });
  }

  const service = await factory(config);

  const server = micro(service);
  server.on("close", () => {
    if (process.env.REDIS_E2E) {
      config.queue.destroy();
    }
  });
  return new Promise(resolve => {
    server.listen(port, err => {
      resolve(server);
    });
  });
};
