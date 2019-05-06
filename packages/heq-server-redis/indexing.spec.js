const adapter = require("./index");
const redis = require("redis");
const { execSync } = require("child_process");

const clean = async config =>
  new Promise(resolve => {
    const client = redis.createClient({ url: config.url });

    client.keys(`{${config.ns}}::*`, (err, keys) => {
      client.del([...keys], () => {
        client.quit(resolve);
      });
    });
  });

describe("indexing", () => {
  it("should not search linearly", async () => {
    jest.setTimeout(30e3);
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test_indexing__",
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    const events = makeRandomEvents(100000, ["type1", "type2", "type3"]);
    await Promise.all([...events].map(event => queue.commit(event)));

    await queue.commit({ type: "type4", payload: { counter: 100000 } });

    console.time("start generating events");
    for await (let buffer of queue.generate(0, 10, 10, ["type4"])) {
      expect(buffer).toHaveLength(1);
      break;
    }
    console.timeEnd("start generating events");

    console.time("start generating events 3");
    let count = 0;
    for await (let buffer of queue.generate(0, 300, 10, ["type3"])) {
      count += buffer.length;

      if (count >= 33000) break;
    }
    console.timeEnd("start generating events 3");
    await sleep(100);
    queue.destroy();
  });

  it("should not use partial index", async () => {
    jest.setTimeout(100);
    const config = {
      url: "redis://localhost:6379/2",
      ns: "__test_indexing_partial__",
    };

    const queue = adapter(config);
    await clean(config);

    try {
      const events = makeRandomEvents(100, [
        "type1",
        "type2",
        "type3",
        "type4",
      ]);
      await Promise.all([...events].map(event => queue.commit(event)));

      execSync(`redis-cli -n 2 del {${config.ns}}::TYPE::type3`);
      execSync(`redis-cli -n 2 incrby {${config.ns}}::index_count -25`);

      let count = 0;
      for await (let buffer of queue.generate(0, 300, 10, ["type3", "type4"])) {
        count += buffer.length;
        if (count >= 50) break;
      }
      expect(count).toBe(50);
    } finally {
      queue.destroy();
    }
  });
});

function* makeRandomEvents(count, types) {
  for (let i = 0; i < count; ++i) {
    const typeIndex = i % types.length;
    const type = types[typeIndex];

    const event = {
      type,
      payload: { counter: i },
    };

    yield event;
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
