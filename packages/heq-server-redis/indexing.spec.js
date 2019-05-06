const adapter = require("./index");
const redis = require("redis");

const clean = async config =>
  new Promise(resolve => {
    const client = redis.createClient({ url: config.url });

    client.keys(`{${config.ns}}::TYPE::*`, (err, keys) => {
      client.del(
        [`{${config.ns}}::id`, `{${config.ns}}::events`, ...keys],
        () => {
          client.quit(resolve);
        },
      );
    });
  });

beforeAll(async () => {
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
});

describe("indexing", () => {
  it("should not search linearly", async () => {
    const queueConfig = {
      driver: "@heq/redis-server",
      url: "redis://localhost:6379/2",
      ns: "__test_indexing__",
    };

    const queue = adapter(queueConfig);
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
});

function* makeRandomEvents(count, types) {
  for (let i = 0; i < count; ++i) {
    const typeIndex = i % 3;
    const type = types[typeIndex];

    const event = {
      type,
      payload: { counter: i },
    };

    yield event;
  }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
