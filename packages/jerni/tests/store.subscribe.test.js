const createJourney = require("../lib/createJourney2");
const makeServer = require("./makeServer");
const makeTestStore = require("./makeTestStore");

test("should subscribe", async () => {
  jest.setTimeout(1000);
  const { queue, server } = await makeServer({
    ns: "test_subscribe_1",
    port: 19090,
  });

  const driver = await queue.DEV__getDriver();
  driver.clear();

  const store = makeTestStore(event => event.id);

  const journey = createJourney({
    writeTo: "http://localhost:19090",
    stores: [store],
  });

  for (let i = 0; i < 10; ++i) {
    await journey.commit({
      type: "TEST",
      payload: { key: "value" },
      meta: { some: "meta" },
    });
  }

  const db = await store.getDriver();
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
  server.close();

  expect(db).toHaveLength(20);
});

test("should subscribe with filter", async () => {
  jest.setTimeout(1000);
  const { queue, server } = await makeServer({
    ns: "test_subscribe_2",
    port: 19091,
  });

  const driver = await queue.DEV__getDriver();
  driver.clear();

  const store = makeTestStore(event => event.id);
  store.meta.includes = ["type_1", "type_2"];

  const journey = createJourney({
    writeTo: "http://localhost:19091",
    stores: [store],
  });

  for (let i = 0; i < 30; ++i) {
    await journey.commit({
      type: `type_${(i % 3) + 1}`,
      payload: { key: "value" },
      meta: { some: "meta" },
    });
  }

  const db = await store.getDriver();
  for await (const output of journey.begin()) {
    if (output.some(o => o === "done 29")) break;
  }
  server.close();

  expect(db).toHaveLength(20);
});
