const migrate = require("../src/migrate");
const makeServer = require("./makeServer");
const makeTestLogger = require("./makeTestLogger");

test("it should migrate everything if no configuration specified", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { server: srv1, queue: src } = await makeServer({ port: 19999 });
  const { server: srv2, queue: dest } = await makeServer({ port: 19998 });

  try {
    for (let i = 0; i < 20; ++i) {
      await src.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    expect(await src.getLatest()).toEqual({
      id: 20,
      payload: { key: 19 },
      type: "type_9",
    });

    for await (const output of migrate(
      "http://localhost:19999",
      "http://localhost:19998",
      { logger },
    )) {
      logger.info(output);
    }
    const results = await dest.query({ from: 0 });

    expect(results).toHaveLength(20);

    expect(results).toMatchSnapshot("replicate everything");
    expect(logs).toMatchSnapshot("DEBUG level logs");
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});
