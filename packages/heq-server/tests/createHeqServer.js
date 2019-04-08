const micro = require("micro");
const http = require("http");
const ports = require("port-authority");
const factory = require("../src/factory");

module.exports = async function createServer(port) {
  const config = {
    http: { port },
  };

  if (process.env.REDIS_E2E) {
    const { execSync } = require("child_process");

    execSync("redis-cli -n 2 flush");

    config.queue = {
      driver: "@heq/server-redis",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };
  }

  const service = await factory();

  const server = micro(service);
  return new Promise(resolve => {
    server.listen(port, err => {
      resolve(server);
    });
  });
};
