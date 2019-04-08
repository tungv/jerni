const micro = require("micro");
const got = require("got");
const ports = require("port-authority");
const createServer = require("./createHeqServer");
const ensureDestroy = require("./teardown");
const commitSomething = require("./testCommit");
const simpleParse = require("./simpleParse");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("http::query", () => {
  it("should able to query", async () => {
    const port = await ports.find(31000);
    const server = await createServer(port);
    ensureDestroy(server);

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const { body } = await got(`http://localhost:${port}/query`, {
      json: true,
      query: {
        lastEventId: 2,
      },
    });

    server.destroy();

    expect(body).toEqual([
      { id: 3, payload: { key: "value" }, type: "TEST" },
      { id: 4, payload: { key: "value" }, type: "TEST" },
      { id: 5, payload: { key: "value" }, type: "TEST" },
    ]);
  });

  it("should able to get latest event", async () => {
    const port = await ports.find(31000);
    const server = await createServer(port);
    ensureDestroy(server);

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const { body } = await got(`http://localhost:${port}/events/latest`, {
      json: true,
      query: {
        lastEventId: 2,
      },
    });

    server.destroy();
    expect(body).toEqual({ id: 5, payload: { key: "value" }, type: "TEST" });
  });

  it("should able to get @@INIT event when empty", async () => {
    const port = await ports.find(31000);
    const server = await createServer(port);
    ensureDestroy(server);

    const { body } = await got(`http://localhost:${port}/events/latest`, {
      json: true,
      query: {
        lastEventId: 2,
      },
    });

    server.destroy();
    expect(body).toEqual({ id: 0, type: "@@INIT" });
  });
});
