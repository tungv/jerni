const initialize = require("../journey");
const makeServer = require("./makeServer");
const makeTestLogger = require("./makeTestLogger");
const start = require("./start");

describe("Mongo Basic", () => {
  test("basic operations", async () => {
    const { server } = await makeServer({
      ns: "e2e_mongo_basic",
      port: 19080,
    });

    const [apiLogger, apiLogs] = makeTestLogger();
    const [cliLogger, cliLogs] = makeTestLogger(makeTestLogger.LEVEL_INFO);

    process.env.NODE_ENV = "development";
    const dev = await initialize("http://localhost:19080", "e2e_mongo_basic");
    await dev.clean();
    await dev.dispose();
    process.env.NODE_ENV = "production";
    const outputs = [];
    const journey = await initialize(
      "http://localhost:19080",
      "e2e_mongo_basic",
      apiLogger,
    );

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
        (output) => {
          outputs.push(output);
        },
        initialize,
        "http://localhost:19080",
        "e2e_mongo_basic",
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
            model_A_v1: { added: 2, modified: 2 },
          },
        ],
        [{ model_B_vbeta: { modified: 2 }, model_A_v1: { modified: 2 } }],
      ]);

      expect(apiLogs).toHaveLength(0);
      expect(cliLogs).toMatchSnapshot("cli log");
    } finally {
      server.destroy();
      await journey.dispose();
    }
  });
});
