const makeStore = require("../makeStore");
const { MongoClient } = require("mongodb");

describe("Store", () => {
  it("should provide handleEvents method", async () => {
    await clean("test_1");
    const model = simpleModel();
    const store = await makeStore({
      name: "test_1",
      url: "mongodb://localhost:27017",
      dbName: "test_1",
      models: [model],
    });

    await store.handleEvents([
      { id: 1, type: "test" },
      { id: 2, type: "test" },
      { id: 3, type: "test" },
    ]);

    const coll = await store.getDriver(model);
    const rows = await coll.find({}).toArray();
    expect(rows).toEqual([
      {
        __op: 0,
        __v: 1,
        _id: 1,
      },
      {
        __op: 0,
        __v: 2,
        _id: 2,
      },
      {
        __op: 0,
        __v: 3,
        _id: 3,
      },
    ]);
  });

  it("should update last seen", async () => {
    await clean("test_2");
    const model = simpleModel();
    const store = await makeStore({
      name: "test_2",
      url: "mongodb://localhost:27017",
      dbName: "test_2",
      models: [model],
    });

    const lastSeenAtTheBeginning = await store.getLastSeenId();

    expect(lastSeenAtTheBeginning).toBe(0);

    await store.handleEvents([
      { id: 1, type: "test" },
      { id: 2, type: "test" },
      { id: 3, type: "test" },
    ]);

    const lastSeenAfterUpdate = await store.getLastSeenId();

    expect(lastSeenAfterUpdate).toBe(3);
  });

  it("should be able to subscribe to new changes on different store instance", async () => {
    // make 2 store
    await clean("test_3");

    const model = simpleModel();
    const storeForPublish = await makeStore({
      name: "test_3",
      url: "mongodb://localhost:27017",
      dbName: "test_3",
      models: [model],
    });

    const storeForSubscribe = await makeStore({
      name: "test_3",
      url: "mongodb://localhost:27017",
      dbName: "test_3",
      models: [model],
    });

    (async function() {
      await sleep(100);
      await storeForPublish.handleEvents([{ id: 1, type: "test" }]);
      await sleep(100);
      await storeForPublish.handleEvents([{ id: 2, type: "test" }]);
    })();

    for await (const checkpoint of storeForSubscribe.listen()) {
      if (checkpoint === 2) {
        break;
      }
    }
  });
});

function simpleModel() {
  return {
    name: "test_model",
    version: "1.0.0",
    transform(event) {
      return [
        {
          insertOne: { _id: event.id },
        },
      ];
    },
  };
}

async function clean(dbName) {
  const client = await MongoClient.connect("mongodb://localhost:27017", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = client.db(dbName);
  await db.dropDatabase();
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
