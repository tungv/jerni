const JerniPersistenceTimeout = require("../lib/JerniPersistenceTimeout");
const createJourney = require("../lib/createJourney2");
const makeServer = require("./makeServer");
const makeTestStore = require("./makeTestStore");

describe("#waitFor", () => {
  it("should throw JerniPersistenceTimeout error after a given amount of time to wait", async () => {
    jest.setTimeout(1000);
    const { server } = await makeServer({
      port: 19060,
      ns: "test_wait_for",
    });

    try {
      const store = makeTestStore(event => event.id);
      const db = await store.getDriver();

      const journey = createJourney({
        writeTo: "http://localhost:19060",
        stores: [store],
      });

      const event = await journey.commit({ type: "test" });

      await expect(journey.waitFor(event, 100)).rejects.toBeInstanceOf(
        JerniPersistenceTimeout,
      );
      expect(db).toHaveLength(0);
    } finally {
      server.close();
    }
  });

  it("should wait until the event is fully committed to stores", async () => {
    jest.setTimeout(1000);
    const { server } = await makeServer({
      port: 19060,
      ns: "test_wait_for",
    });

    try {
      const store = makeTestStore(event => event.id);
      const db = await store.getDriver();

      const journey = createJourney({
        writeTo: "http://localhost:19060",
        stores: [store],
      });

      const subInstance = createJourney({
        writeTo: "http://localhost:19060",
        stores: [store],
      });

      (async function() {
        for await (const item of subInstance.begin({ pulseTime: 1 })) {
        }
      })();

      await sleep(500);

      const event = await journey.commit({ type: "test" });

      await journey.waitFor(event, 100);
      expect(db).toHaveLength(1);
    } finally {
      server.close();
    }
  });

  it("should not introduce memleak if waitFor is called many times", async () => {
    jest.setTimeout(1000);
    const { server } = await makeServer({
      port: 19060,
      ns: "test_wait_for",
    });

    try {
      const store = makeTestStore(event => event.id);
      const db = await store.getDriver();

      const journey = createJourney({
        writeTo: "http://localhost:19060",
        stores: [store],
      });

      const subInstance = createJourney({
        writeTo: "http://localhost:19060",
        stores: [store],
      });

      (async function() {
        // eslint-disable-next-line no-unused-vars
        for await (const _ of subInstance.begin({ pulseTime: 1 })) {
        }
      })();

      await sleep(500);

      await journey.commit({ type: "test" });
      await journey.commit({ type: "test" });
      await journey.commit({ type: "test" });
      await journey.commit({ type: "test" });
      await journey.commit({ type: "test" });

      await Promise.all([
        journey.waitFor({ id: 1 }, 100),
        journey.waitFor({ id: 2 }, 100),
        journey.waitFor({ id: 3 }, 100),
        journey.waitFor({ id: 4 }, 100),
        journey.waitFor({ id: 5 }, 100),
      ]);
      expect(db).toHaveLength(5);
      expect(store.getListenersCount()).toBe(0);
    } finally {
      server.close();
    }
  });
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
