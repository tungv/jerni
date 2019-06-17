const mitt = require("mitt");
const test = require("ava");

const { Model: DummyModel, Store: DummyStore } = require("./DummyStore");

const { version, name } = require("../package.json");
const createJourney = require("../lib/createJourney");
const makeServer = require("./makeServer");

test("createJourney to return a journey", t => {
  const dummyStore = new DummyStore({});

  const journey = createJourney({
    writeTo: "http://localhost:8080",
    stores: [dummyStore],
  });

  t.true(typeof journey.getReader === "function");
  t.true(typeof journey.commit === "function");
  t.true(typeof journey.waitFor === "function");
});

test("journey should be able to commit event", async t => {
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

  t.truthy(event.id);
  t.deepEqual(event.type, "TEST");
  t.deepEqual(event.payload, { key: "value" });
  t.deepEqual(event.meta.some, "meta");
  t.deepEqual(event.meta.client, name);
  t.deepEqual(event.meta.clientVersion, version);

  t.true(event.meta.occurred_at - now >= 0 && event.meta.occurred_at - now < 5);

  server.close();
});

test("journey should return specific driver instance", async t => {
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

  t.is(journey.getReader(model1), "internal_1@conn_1");
  t.is(journey.getReader(model2), "internal_2@conn_1");
  t.is(journey.getReader(model3), "internal_3@conn_1");
  t.is(journey.getReader(model4), "internal_4@conn_1");
});

test("journey should waitFor all models", async t => {
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
  t.true(duration > 100 && duration <= 120);
});

test("should throw if some models don't have a meta", t => {
  const model1 = new DummyModel({ name: "internal_1" });
  const model2 = new DummyModel({
    name: "internal_2",
    meta: {
      includes: ["TYPE1", "TYPE2"],
    },
  });
  const model3 = new DummyModel({ name: "internal_3" });
  const model4 = new DummyModel({ name: "internal_4" });

  t.throws(() => {
    const conn = new DummyStore({
      name: "conn_1",
      models: [model1, model2, model3, model4],
    });
    createJourney({
      writeTo: "http://localhost:8080",
      stores: [conn],
    });
  });
});

test("should throw if the last model doesn't have a meta", t => {
  const model1 = new DummyModel({ name: "internal_1" });
  const model2 = new DummyModel({
    name: "internal_2",
    meta: {
      includes: ["TYPE1", "TYPE2"],
    },
  });

  t.notThrows(() => {
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
  });
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
