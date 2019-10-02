const test = require("ava");

const createJourney = require("../lib/createJourney2");
const makeServer = require("./makeServer");

test("#begin() should terminate subscription if client overflows", async t => {
  const { server } = await makeServer({
    ns: "test-back-pressure",
    port: 19081,
  });

  try {
    const store = makeTestStore(event => event.id);

    const journey = createJourney({
      writeTo: "http://localhost:19081",
      stores: [store],
    });

    await journey.commit({ type: "type_1", payload: {} });
    await journey.commit({ type: "type_2", payload: {} });
    await journey.commit({ type: "type_3", payload: {} });

    const db = await store.getDriver();
    const outputs = [];
    for await (const output of journey.begin()) {
      // only 2 possible events because we have filters by type
      outputs.push(output);
      if (db.length === 2) {
        t.deepEqual(db, [1, 2]);
        break;
      }
    }

    t.deepEqual(outputs, [["done 2"]]);

    // journey.destroy();
  } finally {
    server.close();
  }
});

function makeTestStore(transform) {
  const db = [];
  let listeners = [];

  const store = {
    name: "test_store",
    meta: {
      includes: ["type_1", "type_2"],
    },
    registerModels(map) {},
    subscribe(listener) {
      listeners.push(listeners);

      return () => {
        listeners = listeners.filter(fn => fn !== listener);
      };
    },
    async handleEvent(events) {
      await sleep(1000 * events.length);
      db.push(...events.map(transform));
      listeners.forEach(fn => fn(last(events).id));
      return `done ${last(events).id}`;
    },

    async getDriver() {
      return db;
    },

    async getLastSeenId() {
      const event = last(db);
      if (event) return event.id;
      return 0;
    },
  };

  return store;
}

const last = array => (array.length >= 1 ? array[array.length - 1] : null);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
