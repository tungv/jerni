const createJourney = require("../lib/createJourney2");
const mapEvents = require("../lib/mapEvents");
const makeServer = require("./makeServer");
const makeTestStore = require("./makeTestStore");
const makeTestLogger = require("./makeTestLogger");

test("#begin() should push events to stores", async () => {
  const { server } = await makeServer({
    ns: "test-begin-method",
    port: 19080,
  });

  const [logger, logs] = makeTestLogger();

  try {
    const store = makeTestStore(
      mapEvents({
        type_1: event => event.id,
        type_2: event => event.id,
      }),
    );

    const journey = createJourney({
      writeTo: "http://localhost:19080",
      stores: [store],
    });

    await journey.commit({ type: "type_1", payload: {} });
    await journey.commit({ type: "type_2", payload: {} });
    await journey.commit({ type: "type_3", payload: {} });

    const db = await store.getDriver();
    const outputs = [];
    for await (const output of journey.begin({ logger })) {
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
    expect(logs.join("\n")).toMatchSnapshot();
  }
});
