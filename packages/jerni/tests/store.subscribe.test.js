const createJourney = require("../lib/createJourney2");
const makeServer = require("./makeServer");
const makeTestLogger = require("./makeTestLogger");
const makeTestStore = require("./makeTestStore");
const mapEvents = require("../lib/mapEvents");

test("should subscribe", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { queue, server } = await makeServer({
    ns: "test_subscribe_1",
    port: 19090,
  });

  const store = makeTestStore(event => event.id);
  const db = await store.getDriver();
  try {
    const driver = await queue.DEV__getDriver();
    driver.clear();

    const journey = createJourney({
      writeTo: "http://localhost:19090",
      stores: [store],
      logger,
    });

    for (let i = 0; i < 10; ++i) {
      await journey.commit({
        type: "TEST",
        payload: { key: "value" },
        meta: { some: "meta" },
      });
    }

    expect(db).toHaveLength(0);

    for await (const output of journey.begin()) {
      if (output.some(o => o === "done 10")) break;
    }

    for (let i = 0; i < 10; ++i) {
      await journey.commit({
        type: "TEST",
        payload: { key: "value" },
        meta: { some: "meta" },
      });
    }
    for await (const output of journey.begin()) {
      if (output.some(o => o === "done 20")) break;
    }
    expect(db).toHaveLength(20);
  } finally {
    server.destroy();
    expect(logs.join("\n")).toMatchSnapshot();
  }
});

test("should subscribe with filter", async () => {
  jest.setTimeout(1000);
  const { queue, server } = await makeServer({
    ns: "test_subscribe_2",
    port: 19091,
  });

  const driver = await queue.DEV__getDriver();
  driver.clear();

  const store = makeTestStore(
    mapEvents({
      type_1: event => event.id,
      type_2: event => event.id,
    }),
  );

  const [logger, logs] = makeTestLogger();

  try {
    const journey = createJourney({
      writeTo: "http://localhost:19091",
      stores: [store],
      logger,
    });

    for (let i = 0; i < 30; ++i) {
      await journey.commit({
        type: `type_${(i % 3) + 1}`,
        payload: { key: "value" },
        meta: { some: "meta" },
      });
    }

    for await (const output of journey.begin()) {
      if (output.some(o => o === "done 29")) break;
    }
    const db = await store.getDriver();
    expect(db).toHaveLength(20);
  } finally {
    server.destroy();
    expect(logs.join("\n")).toMatchSnapshot();
  }
});
