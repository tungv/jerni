const got = require("got");
const ports = require("port-authority");
const createServer = require("./createHeqServer");
const ensureDestroy = require("./teardown");
const commitSomething = require("./testCommit");
const simpleParse = require("./simpleParse");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("http::subscribe", () => {
  it("should able to subscribe from the beginning", async done => {
    jest.setTimeout(500);
    const port = await ports.find(32000);
    const server = await createServer(port);
    ensureDestroy(server);

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const stream = got.stream(`http://localhost:${port}/subscribe`, {
      headers: {
        "Last-Event-ID": 2,
        "Burst-Time": 1,
        "Burst-Count": 2,
      },
    });

    const buffer = [];

    stream.on("data", data => {
      const msg = String(data);

      buffer.push(msg);

      // stop after receiving event #5
      if (msg.includes("id: 5")) {
        server.destroy();
      }
    });

    stream.on("end", () => {
      expect(simpleParse(buffer.join(""))).toEqual([
        { id: 3, payload: { key: "value" }, type: "TEST" },
        { id: 4, payload: { key: "value" }, type: "TEST" },
        { id: 5, payload: { key: "value" }, type: "TEST" },
      ]);
      done();
    });
  });

  it("should able to subscribe from a past event id", async done => {
    jest.setTimeout(500);
    const port = await ports.find(32000);
    const server = await createServer(port);
    ensureDestroy(server);

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const stream = got.stream(`http://localhost:${port}/subscribe`, {
      headers: {
        "Last-Event-ID": 2,
        "Burst-Time": 1,
      },
    });

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const buffer = [];

    stream.on("data", data => {
      const msg = String(data);

      buffer.push(msg);

      // stop after receiving event #10
      if (msg.includes("id: 10")) {
        server.destroy();
      }
    });

    stream.on("end", async () => {
      sleep(1);
      const events = simpleParse(buffer.join(""));

      expect(events).toEqual([
        { id: 3, payload: { key: "value" }, type: "TEST" },
        { id: 4, payload: { key: "value" }, type: "TEST" },
        { id: 5, payload: { key: "value" }, type: "TEST" },
        { id: 6, payload: { key: "value" }, type: "TEST" },
        { id: 7, payload: { key: "value" }, type: "TEST" },
        { id: 8, payload: { key: "value" }, type: "TEST" },
        { id: 9, payload: { key: "value" }, type: "TEST" },
        { id: 10, payload: { key: "value" }, type: "TEST" },
      ]);
      done();
    });
  });

  it("should wait for a specific time ", async done => {
    const port = await ports.find(32000);
    const server = await createServer(port);
    ensureDestroy(server);

    const stream = got.stream(`http://localhost:${port}/subscribe`, {
      headers: {
        "Last-Event-ID": 0,
        "Burst-Time": 100,
      },
    });

    setTimeout(() => {
      server.destroy();
    }, 400);

    for (let i = 0; i < 5; ++i) {
      await sleep(45);
      await commitSomething({ port });
    }

    const received = [];

    stream.on("data", data => {
      const msg = String(data);
      for (const item of msg.split("\n\n")) {
        if (item.startsWith(":ok")) {
          continue;
        }

        const idRow = item.split("\n")[0];
        const id = idRow.substr(4);
        if (id) received.push(id);
      }
    });

    stream.on("end", async () => {
      sleep(1);
      expect(received).toEqual(["2", "4", "5"]);
      done();
    });
  });
});
