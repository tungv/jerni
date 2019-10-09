const createJourney = require("../lib/createJourney2");
const makeServer = require("./makeServer");

let server;

afterEach(() => {
  server.close();
});

test("#begin() should terminate subscription if client overflows", async () => {
  const MAX = 500;
  jest.setTimeout(MAX * 50 * 1.2);
  server = (await makeServer({
    ns: "test-back-pressure",
    port: 19081,
  })).server;

  try {
    const store = makeTestStore(event => event.id);

    const journey = createJourney({
      writeTo: "http://localhost:19081",
      stores: [store],
    });

    for (let i = 0; i < MAX; ++i) {
      await journey.commit({ type: "type_1" });
    }

    const db = await store.getDriver();
    const outputs = [];
    for await (const output of journey.begin({ pulseCount: 100 })) {
      outputs.push(output);
      if (output.some(data => data === "done " + String(MAX))) break;
    }

    expect(db).toHaveLength(MAX);

    // journey.destroy();
  } finally {
    console.log("finally");
    // server.close();
  }
});

function makeTestStore(transform) {
  const db = [];
  let listeners = [];
  let isRunning = false;

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
      if (isRunning) {
        throw new Error("handleEvents should be called once at a time");
      }
      isRunning = true;

      await sleep(50 * events.length);
      const latest = last(db) ? last(db) : 0;
      // console.log("latest in db", latest);
      const rows = events.filter(e => e.id > latest).map(transform);
      // console.log("inserting rows", rows);
      db.push(...rows);
      listeners.forEach(fn => fn(last(events).id));
      isRunning = false;
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
