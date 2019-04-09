const adapter = require("./index");
const redis = require("redis");

const clean = async config =>
  new Promise(resolve => {
    const client = redis.createClient({ url: config.url });

    client.del([`{${config.ns}}::id`, `{${config.ns}}::events`], () => {
      client.quit(resolve);
    });
  });

describe("redis adapter", () => {
  it("should commit", async () => {
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    const event = {
      type: "test",
      payload: { a: 1 },
    };

    const e1 = await queue.commit(event);

    expect(e1).toEqual({
      id: 1,
      type: "test",
      payload: { a: 1 },
    });

    const e2 = await queue.commit(event);

    expect(e2).toEqual({
      id: 2,
      type: "test",
      payload: { a: 1 },
    });

    queue.destroy();
  });

  it("should query in range", async () => {
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    for (let i = 0; i < 10; ++i) {
      await queue.commit({ type: "test", payload: i + 1 });
    }

    const events = await queue.query({ from: 2, to: 5 });
    expect(events).toEqual([
      { id: 3, type: "test", payload: 3 },
      { id: 4, type: "test", payload: 4 },
      { id: 5, type: "test", payload: 5 },
    ]);
    queue.destroy();
  });

  it("should query up to latest", async () => {
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    for (let i = 0; i < 10; ++i) {
      await queue.commit({ type: "test", payload: i + 1 });
    }

    const events = await queue.query({ from: 2 });
    expect(events).toEqual([
      { id: 3, type: "test", payload: 3 },
      { id: 4, type: "test", payload: 4 },
      { id: 5, type: "test", payload: 5 },
      { id: 6, type: "test", payload: 6 },
      { id: 7, type: "test", payload: 7 },
      { id: 8, type: "test", payload: 8 },
      { id: 9, type: "test", payload: 9 },
      { id: 10, type: "test", payload: 10 },
    ]);

    await queue.destroy();
  });

  it("should return [] when query if queue is empty", async () => {
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    const events = await queue.query({ from: 0 });
    expect(events).toEqual([]);
    await queue.destroy();
  });

  it("should get latest", async () => {
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    for (let i = 0; i < 10; ++i) {
      await queue.commit({ type: "test", payload: i + 1 });
    }

    const latest = await queue.getLatest();
    expect(latest).toEqual({ id: 10, type: "test", payload: 10 });
    queue.destroy();
  });

  it("should return @@INIT if empty", async () => {
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    const latest = await queue.getLatest();
    expect(latest).toEqual({ id: 0, type: "@@INIT" });
    queue.destroy();
  });

  it("should subscribe", async done => {
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    for (let i = 0; i < 5; ++i) {
      await queue.commit({ type: "test", payload: i + 1 });
    }

    const next5 = [];
    (async function() {
      for await (const buffer of queue.generate(5, 2, 10, () => true)) {
        next5.push(...buffer);

        if (last(buffer).id === 10) {
          break;
        }
      }

      queue.destroy();
      expect(next5).toEqual([
        { id: 6, payload: 6, type: "test" },
        { id: 7, payload: 7, type: "test" },

        { id: 8, payload: 8, type: "test" },
        { id: 9, payload: 9, type: "test" },
        { id: 10, payload: 10, type: "test" },
      ]);

      done();
    })();

    (async function() {
      for (let i = 5; i < 10; ++i) {
        await queue.commit({ type: "test", payload: i + 1 });
        await sleep(5);
      }
    })();
  });

  it("should clean up", async () => {
    const MAX_CLIENTS = 200;
    jest.setTimeout(MAX_CLIENTS * 15);
    /**
     * I'm going to create 10 clients, each of them will subscribe with different ending conditions
     */
    // only one queue
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test__",
    };

    await clean(queueConfig);
    const queue = adapter(queueConfig);

    const outputs = [];

    const start = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`starting memory ${Math.round(start * 100) / 100} MB`);

    for (let i = 0; i < MAX_CLIENTS; ++i) {
      outputs.push([]);
      (async function() {
        for await (const buffer of queue.generate(0, 2, 10, () => true)) {
          outputs[i].push(...buffer);

          if (last(buffer).id === 100) {
            break;
          }
        }
      })();
    }

    // commit
    for (let i = 0; i < 100; ++i) {
      await queue.commit({ type: "test", payload: i + 1 });
      await sleep(5);
    }

    for (let i = 0; i < MAX_CLIENTS; ++i) {
      expect(outputs[i].length === 100);
    }

    sleep(100);

    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    const consumption = used - start;

    console.log(`ending memory ${Math.round(used * 100) / 100} MB`);
    console.log(
      `The script uses approximately ${Math.round(consumption * 100) /
        100} MB for ${MAX_CLIENTS} clients`,
    );

    await queue.destroy();
  });
});

const last = array => (array.length >= 1 ? array[array.length - 1] : null);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
