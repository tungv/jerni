const enableDestroy = require("server-destroy");

const servers = new Set();

module.exports = function ensureDestroy(server) {
  servers.add(server);
  enableDestroy(server);
};

afterAll(() => {
  for (const server of servers) {
    server.destroy();
  }
});
