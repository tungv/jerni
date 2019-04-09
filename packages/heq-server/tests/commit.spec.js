const got = require("got");
const ports = require("port-authority");
const createServer = require("./createHeqServer");
const ensureDestroy = require("./teardown");

describe("http::commit", () => {
  it("should able to commit", async () => {
    const port = await ports.find(30000);
    const server = await createServer(port);
    ensureDestroy(server);

    const { body } = await got(`http://localhost:${port}/commit`, {
      json: true,
      body: {
        type: "TEST",
        payload: {
          key: "value",
        },
      },
    });

    server.destroy();

    expect(body).toEqual({ id: 1, payload: { key: "value" }, type: "TEST" });
  });
});
