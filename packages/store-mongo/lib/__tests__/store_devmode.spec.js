const makeStore = require("../makeStore");
const { MongoClient } = require("mongodb");

describe("Dev mode", () => {
  it("should include DEV_clean method in DEV mode", async () => {
    await clean("test_dev_1");
    const model = simpleModel();
    const store = await makeStore({
      name: "test_dev_1",
      url: "mongodb://localhost:27017",
      dbName: "test_dev_1",
      models: [model],
      dev: true,
    });

    await store.handleEvents([{ id: 1 }, { id: 2 }]);
    await store.DEV_clean();
    const coll = await store.getDriver(model);

    expect(await coll.countDocuments({})).toBe(0);
    expect(await store.getLastSeenId()).toBe(0);
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
