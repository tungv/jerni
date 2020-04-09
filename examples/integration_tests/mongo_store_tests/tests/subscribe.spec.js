const initialize = require("../journey");
const makeServer = require("./makeServer");
const makeTestLogger = require("./makeTestLogger");

async function start(reporter, initializer, ...params) {
  const journey = await initializer(...params);

  for await (const output of journey.begin()) {
    const brk = await reporter(output);
    if (brk) break;
  }

  await journey.dispose();
}

describe("Mongo Basic", () => {
  test("basic operations", async () => {
    const { server } = await makeServer({
      ns: "e2e_mongo_basic",
      port: 19080,
    });

    const [apiLogger, apiLogs] = makeTestLogger();
    const [cliLogger, cliLogs] = makeTestLogger(makeTestLogger.LEVEL_INFO);

    process.env.NODE_ENV = "development";
    const dev = await initialize("http://localhost:19080");
    await dev.clean();
    await dev.dispose();
    process.env.NODE_ENV = "production";
    const outputs = [];
    const journey = await initialize("http://localhost:19080", apiLogger);

    try {
      await journey.commit({
        type: "created",
        payload: { id: "1", name: "test_1" },
      });
      await journey.commit({
        type: "created",
        payload: { id: "2", name: "test_2" },
      });
      await journey.commit({
        type: "renamed",
        payload: { id: "1", name: "test_1_renamed" },
      });
      await journey.commit({
        type: "renamed",
        payload: { id: "2", name: "test_2_renamed" },
      });

      start(
        output => {
          outputs.push(output);
        },
        initialize,
        "http://localhost:19080",
        cliLogger,
      );

      await journey.waitFor({ id: 4 });
      journey.commit({
        type: "renamed",
        payload: { id: "1", name: "test_1_renamed_again" },
      });
      journey.commit({
        type: "renamed",
        payload: { id: "2", name: "test_2_renamed_again" },
      });
      await journey.waitFor({ id: 6 });

      const ModelA = await journey.getReader(initialize.ModelA);
      const ModelB = await journey.getReader(initialize.ModelB);

      expect(await ModelA.find().toArray()).toEqual([
        expect.objectContaining({
          id: "1",
          name: "test_1_renamed_again",
        }),
        expect.objectContaining({
          id: "2",
          name: "test_2_renamed_again",
        }),
      ]);

      expect(await ModelB.find().toArray()).toEqual([
        expect.objectContaining({
          id: "1",
          names: ["test_1", "test_1_renamed", "test_1_renamed_again"],
        }),
        expect.objectContaining({
          id: "2",
          names: ["test_2", "test_2_renamed", "test_2_renamed_again"],
        }),
      ]);

      expect(outputs).toEqual([
        [
          {
            model_B_vbeta: { added: 2, modified: 2 },
            model_a_v1: { added: 2, modified: 2 },
          },
        ],
        [{ model_B_vbeta: { modified: 2 }, model_a_v1: { modified: 2 } }],
      ]);

      expect(apiLogs).toHaveLength(0);
      expect(cliLogs).toMatchSnapshot("cli log");
    } finally {
      server.destroy();
      await journey.dispose();
    }
  });

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
      port: 19080,
    });

    const [apiLogger, apiLogs] = makeTestLogger();
    const [cliLogger, cliLogs] = makeTestLogger(makeTestLogger.LEVEL_INFO);

    // prepare data
    process.env.NODE_ENV = "development";
    const dev = await initialize("http://localhost:19080");
    await dev.clean();
    await dev.dispose();
    process.env.NODE_ENV = "production";

    const outputs = [];

    const journey = await initialize("http://localhost:19080", apiLogger);
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
        output => {
          outputs.push(output);
        },
        initialize,
        "http://localhost:19080",
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
        output => {
          outputs.push(output);
          // stop
          return true;
        },
        initialize,
        "http://localhost:19080",
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
});
