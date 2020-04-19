const migrate = require("../src/migrate");
const makeServer = require("./makeServer");

test("it should migrate everything if no configuration file specified", async () => {
  jest.setTimeout(1000);
  const { queue: src, server: srv1 } = await makeServer({ port: 19999 });
  const { queue: dest, server: srv2 } = await makeServer({ port: 19998 });

  for (let i = 0; i < 100; ++i) {
    await src.commit({
      type: "type_" + (i % 10),
      payload: { key: i },
    });
  }

  expect(await src.getLatest()).toEqual({
    id: 100,
    payload: { key: 99 },
    type: "type_9",
  });

  for await (const output of migrate(
    "http://localhost:19999",
    "http://localhost:19998",
    (x) => x,
  )) {
    console.log(output);
  }
});
