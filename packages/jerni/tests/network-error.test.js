const makeTestStore = require("./makeTestStore");
const createJourney = require("../lib/createJourney2");
const makeTestLogger = require("./makeTestLogger");
const makeServer = require("./makeServer");

describe("IO error handling", () => {
  it("should recover when connection to heq-server fails", async () => {
    jest.setTimeout(2000);
    const [logger, logs] = makeTestLogger();
    let { queue, server } = await makeServer({
      ns: "test-begin-method",
      port: 19070,
    });

    try {
      const store = makeTestStore(event => event.id);

      const journey = createJourney({
        writeTo: "http://localhost:19070",
        stores: [store],
        logger,
      });

      await journey.commit({ type: "event1", payload: {} });

      (async function() {
        await sleep(100);
        console.log("kill");
        server.destroy();
        await sleep(100);
        server = (
          await makeServer({
            ns: "test-begin-method",
            port: 19070,
            queue,
          })
        ).server;
        console.log("server restored");
        await journey.commit({ type: "event2", payload: {} });
      })();

      const db = await store.getDriver();
      for await (const output of journey.begin()) {
        if (output.some(o => o === "done 2")) break;
      }

      expect(db).toEqual([1, 2]);
    } finally {
      server.destroy();
      expect(logs.join("\n")).toMatchSnapshot();
    }
  });
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
