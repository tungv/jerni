const createJourney = require("../lib/createJourney2");
const makeServer = require("./makeServer");

test("#begin() should push events to stores", async () => {
  const { server } = await makeServer({
    ns: "test-begin-method",
    port: 19080,
  });

  try {
    const store = makeTestStore(event => event.id);

    const journey = createJourney({
      writeTo: "http://localhost:19080",
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
        expect(db).toEqual([1, 2]);
        break;
      }
    }

    expect(outputs).toEqual([["done 2"]]);

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
    async handleEvents(events) {
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
