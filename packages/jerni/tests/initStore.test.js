const mitt = require("mitt");

const { Model: DummyModel, Store: DummyStore } = require("./DummyStore");

const { version, name } = require("../package.json");
const createJourney = require("../lib/createJourney2");
const makeServer = require("./makeServer");

test("createJourney to return a journey", async () => {
  const dummyStore = new DummyStore({});

  const journey = createJourney({
    writeTo: "http://localhost:8080",
    stores: [dummyStore],
  });

  expect(typeof journey.getReader === "function").toBe(true);
  expect(typeof journey.commit === "function").toBe(true);
  expect(typeof journey.waitFor === "function").toBe(true);
});

test("journey should be able to commit event", async () => {
  const { server } = await makeServer({
    ns: "test_commit",
    port: 18080,
  });

  const dummyStore = new DummyStore({
    name: "conn_0",
    models: [],
  });

  const journey = createJourney({
    writeTo: "http://localhost:18080",
    stores: [dummyStore],
  });

  const now = Date.now();
  const event = await journey.commit({
    type: "TEST",
    payload: { key: "value" },
    meta: { some: "meta" },
  });

  expect(event.id).toBeTruthy();
  expect(event.type).toEqual("TEST");
  expect(event.payload).toEqual({ key: "value" });
  expect(event.meta.some).toEqual("meta");
  expect(event.meta.client).toEqual(name);
  expect(event.meta.clientVersion).toEqual(version);

  expect(
    event.meta.occurred_at - now >= 0 && event.meta.occurred_at - now < 5,
  ).toBe(true);

  server.close();
});

test("journey should return specific driver instance", async () => {
  const model1 = new DummyModel({ name: "internal_1" });
  const model2 = new DummyModel({ name: "internal_2" });
  const model3 = new DummyModel({ name: "internal_3" });
  const model4 = new DummyModel({ name: "internal_4" });
  const conn = new DummyStore({
    name: "conn_1",
    models: [model1, model2, model3, model4],
  });

  const journey = createJourney({
    writeTo: "http://localhost:8080",
    stores: [conn],
  });

  expect(await journey.getReader(model1)).toBe("internal_1@conn_1");
  expect(await journey.getReader(model2)).toBe("internal_2@conn_1");
  expect(await journey.getReader(model3)).toBe("internal_3@conn_1");
  expect(await journey.getReader(model4)).toBe("internal_4@conn_1");
});

test("journey should waitFor all models", async () => {
  const emitter1 = mitt();
  const emitter2 = mitt();

  const model1 = new DummyModel({ name: "internal_1" });
  const model2 = new DummyModel({ name: "internal_2" });
  const model3 = new DummyModel({ name: "internal_3" });
  const model4 = new DummyModel({ name: "internal_4" });

  const conn1 = new DummyStore({
    name: "conn_1",
    models: [model1, model2],
    emitter: emitter1,
  });
  const conn2 = new DummyStore({
    name: "conn_2",
    models: [model3, model4],
    emitter: emitter2,
  });

  const journey = createJourney({
    writeTo: "http://localhost:8080",
    stores: [conn1, conn2],
  });

  const startWaiting = Date.now();
  let duration = 0;
  const waitPromise = journey
    .waitFor({ id: 5 })
    .then(() => (duration = Date.now() - startWaiting));

  await sleep(50);
  emitter1.emit("event", { id: 5 });

  await sleep(50);
  emitter2.emit("event", { id: 5 });

  await waitPromise;
  expect(duration > 100 && duration <= 120).toBe(true);
});

test("should throw if some models don't have a meta", () => {
  const model1 = new DummyModel({ name: "internal_1" });
  const model2 = new DummyModel({
    name: "internal_2",
    meta: {
      includes: ["TYPE1", "TYPE2"],
    },
  });
  const model3 = new DummyModel({ name: "internal_3" });
  const model4 = new DummyModel({ name: "internal_4" });

  expect(() => {
    const conn = new DummyStore({
      name: "conn_1",
      models: [model1, model2, model3, model4],
    });
    createJourney({
      writeTo: "http://localhost:8080",
      stores: [conn],
    });
  }).toThrow();
});

test("should throw if the last model doesn't have a meta", () => {
  const model1 = new DummyModel({ name: "internal_1" });
  const model2 = new DummyModel({
    name: "internal_2",
    meta: {
      includes: ["TYPE1", "TYPE2"],
    },
  });

  expect(() => {
    const connWithoutMeta = new DummyStore({
      name: "conn_1",
      models: [model1],
    });
    createJourney({
      writeTo: "http://localhost:8080",
      stores: [connWithoutMeta],
    });

    const connWithMeta = new DummyStore({
      name: "conn_2",
      models: [model2],
    });
    createJourney({
      writeTo: "http://localhost:8080",
      stores: [connWithMeta],
    });
  }).not.toThrow();
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
