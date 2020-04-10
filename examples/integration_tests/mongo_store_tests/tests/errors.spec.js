const initialize = require("../journey");
const makeServer = require("./makeServer");
const makeTestLogger = require("./makeTestLogger");
const start = require("./start");

describe("error handling", () => {
  test("on constraints error", async () => {
    /*
     * in this test, an unrecoverable error will arise (unqiue constraint)
     * after hitting the error, onError decides to stop the subscription and will remain frozen
     * until a bugfix is in effect
     * the other models will be in an undefined state due to race condition (how far they have processed their logic)
     * however once the issue is fixed, it should resume without any observable side effect
     */
    jest.setTimeout(2000);
    const { server } = await makeServer({
      ns: "e2e_mongo_error",
      port: 19081,
    });

    const [apiLogger, apiLogs] = makeTestLogger();
    const [cliLogger, cliLogs] = makeTestLogger(makeTestLogger.LEVEL_INFO);

    // prepare data
    process.env.NODE_ENV = "development";
    const dev = await initialize("http://localhost:19081", "e2e_mongo_errors");
    await dev.clean();
    await dev.dispose();
    process.env.NODE_ENV = "production";

    const outputs = [];

    const journey = await initialize(
      "http://localhost:19081",
      "e2e_mongo_errors",
      apiLogger,
    );
    try {
      const ModelA = await journey.getReader(initialize.ModelA);
      const ModelB = await journey.getReader(initialize.ModelB);
      await ModelA.createIndex({ id: 1 }, { unique: true });
      await journey.commit({
        type: "created",
        payload: { id: "1", name: "test_1" },
        meta: { occurred_at: 16e11 },
      });
      // this will be causing the issue because we've set a unique constraint on id field
      await journey.commit({
        type: "created",
        payload: { id: "1", name: "test_2" },
        meta: { occurred_at: 16e11 },
      });
      await journey.commit({
        type: "renamed",
        payload: { id: "1", name: "test_1_renamed" },
        meta: { occurred_at: 16e11 },
      });
      // trigger subscription
      // we know this will eventually stop, so we wait until that moment
      await start(
        (output) => {
          outputs.push(output);
        },
        initialize,
        "http://localhost:19081",
        "e2e_mongo_errors",
        cliLogger,
        async function onError(err, event) {
          expect(err.name).toEqual("BulkWriteError");
          expect(event.id).toEqual(2);
          throw new Error();
        },
      );
      // event #2 will stop the subscription, so the effected model (collection) will stop at #1
      expect(await ModelA.find().toArray()).toEqual([
        expect.objectContaining({
          id: "1",
          name: "test_1",
        }),
      ]);
      // because it crashed during the only batch of events, we won't be able to retrieve any output
      expect(outputs).toEqual([]);
      // we try to fix the issue by release the constraint
      await ModelA.dropIndexes();
      // restart
      await start(
        (output) => {
          outputs.push(output);
          // stop
          return true;
        },
        initialize,
        "http://localhost:19081",
        "e2e_mongo_errors",
        cliLogger,
      );
      // since updateOne will update the first document it found, only the first { id: "1" } will be renamed
      expect(await ModelA.find().toArray()).toEqual([
        expect.objectContaining({
          id: "1",
          name: "test_1_renamed",
        }),
        expect.objectContaining({
          id: "1",
          name: "test_2",
        }),
      ]);
      expect(await ModelB.find().toArray()).toEqual([
        expect.objectContaining({
          id: "1",
          names: ["test_1", "test_1_renamed"],
        }),
        expect.objectContaining({
          id: "1",
          names: ["test_2"],
        }),
      ]);
      expect(apiLogs).toHaveLength(0);
      expect(cliLogs).toMatchSnapshot("cli log");
    } finally {
      server.destroy();
      await journey.dispose();
    }
  });

  test("invalid mongo update error", async () => {
    /*
     * in this test, an unrecoverable error will arise (unqiue constraint)
     * after hitting the error, onError decides to stop the subscription and will remain frozen
     * until a bugfix is in effect
     * the other models will be in an undefined state due to race condition (how far they have processed their logic)
     * however once the issue is fixed, it should resume without any observable side effect
     */
    jest.setTimeout(2000);
    const { server } = await makeServer({
      ns: "e2e_mongo_error",
      port: 19081,
    });

    const [apiLogger, apiLogs] = makeTestLogger();
    const [cliLogger, cliLogs] = makeTestLogger(makeTestLogger.LEVEL_INFO);

    // prepare data
    process.env.NODE_ENV = "development";
    const dev = await initialize("http://localhost:19081", "e2e_mongo_errors");
    await dev.clean();
    await dev.dispose();
    process.env.NODE_ENV = "production";

    const outputs = [];

    const journey = await initialize(
      "http://localhost:19081",
      "e2e_mongo_errors",
      apiLogger,
    );
    try {
      const ModelA = await journey.getReader(initialize.ModelA);
      const ModelB = await journey.getReader(initialize.ModelB);

      await journey.commit({
        type: "created",
        payload: { id: "1", name: "test_1" },
        meta: { occurred_at: 16e11 },
      });
      await journey.commit({
        type: "emptySetTest",
        payload: { id: "1" },
        meta: { occurred_at: 16e11 },
      });

      const d = defer();

      // trigger subscription
      // we know this will eventually stop, so we wait until that moment
      start(
        (output) => {
          outputs.push(output);
        },
        initialize,
        "http://localhost:19081",
        "e2e_mongo_errors",
        cliLogger,
        async function onError(err, event) {
          expect(err.name).toEqual("BulkWriteError");
          expect(event.id).toEqual(2);
          expect(err.code).toEqual(28);

          d.resolve();
        },
      );

      await d.promise;

      // event #2 will stop the subscription, so the effected model (collection) will stop at #1
      expect(await ModelA.find().toArray()).toEqual([
        expect.objectContaining({
          id: "1",
          name: "test_1",
        }),
      ]);

      expect(await ModelB.find().toArray()).toEqual([
        expect.objectContaining({
          id: "1",
          names: ["test_1"],
        }),
      ]);
      expect(apiLogs).toHaveLength(0);
      expect(cliLogs).toMatchSnapshot("cli log");
    } finally {
      server.destroy();
      await journey.dispose();
    }
  });
});

function defer() {
  let resolve, reject;

  const promise = new Promise((_1, _2) => {
    resolve = _1;
    reject = _2;
  });
  return {
    promise,
    resolve,
    reject,
  };
}
