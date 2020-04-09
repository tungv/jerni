const createJourney = require("../lib/createJourney2");
const mapEvents = require("../lib/mapEvents");
const makeServer = require("./makeServer");
const makeTestStore = require("./makeTestStore");
const makeTestLogger = require("./makeTestLogger");

test("onError without throwing", async () => {
  jest.setTimeout(300);
  expect.assertions(6);
  const { server } = await makeServer({
    ns: "test-error-handling",
    port: 19084,
  });

  const [logger, logs] = makeTestLogger();

  try {
    const store1 = makeTestStore(
      mapEvents({
        type_1: event => event.id,
        type_2: event => {
          throw new Error("inside handler");
        },
      }),
    );

    const store2 = makeTestStore(
      mapEvents({
        type_1: event => event.id,
        type_2: event => event.id,
      }),
    );

    const journey = createJourney({
      writeTo: "http://localhost:19084",
      stores: [store1, store2],
      logger,
      onError: (error, event, storeWithError) => {
        expect(error.message).toEqual("inside handler");
        expect(store1).toBe(storeWithError);
        expect(event).toEqual(
          expect.objectContaining({
            type: "type_2",
            payload: {},
          }),
        );

        // no throwing means skipping
      },
    });

    await journey.commit({ type: "type_1", payload: {} });
    await journey.commit({ type: "type_2", payload: {} });
    await journey.commit({ type: "type_1", payload: {} });

    const db = await store1.getDriver();
    const outputs = [];
    for await (const output of journey.begin()) {
      // only 2 possible events because we have filters by type
      outputs.push(output);
      if (db.length === 2) {
        expect(db).toEqual([1, 3]);
        break;
      }
    }

    expect(await store2.getDriver()).toEqual([1, 2, 3]);
    expect(logs.join("\n")).toMatchSnapshot();
  } finally {
    server.close();
    server.destroy();
    // console.log(logs.join("\n"));
  }
});

test("onError rethrown", async () => {
  jest.setTimeout(300);
  const { server } = await makeServer({
    ns: "test-error-handling",
    port: 19084,
  });

  const [logger, logs] = makeTestLogger(makeTestLogger.LEVEL_INFO);

  try {
    const store = makeTestStore(
      mapEvents({
        type_1: event => event.id,
        type_2: event => {
          throw new Error("inside handler");
        },
      }),
    );

    const journey = createJourney({
      writeTo: "http://localhost:19084",
      stores: [store],
      logger,
      onError: (error, event, storeWithError) => {
        throw new Error("cannot recover");
      },
    });

    await journey.commit({
      type: "type_1",
      payload: {},
      meta: { occurred_at: 16e11 },
    });
    await journey.commit({
      type: "type_2",
      payload: {},
      meta: { occurred_at: 16e11 },
    });
    await journey.commit({
      type: "type_1",
      payload: {},
      meta: { occurred_at: 16e11 },
    });

    const db = await store.getDriver();
    for await (const output of journey.begin()) {
      console.log(output);
    }

    expect(db).toEqual([1]);
    expect(logs.join("\n")).toMatchSnapshot();
  } finally {
    server.close();
    server.destroy();
  }
});
