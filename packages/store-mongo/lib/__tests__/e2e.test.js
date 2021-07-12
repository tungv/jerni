const { MongoClient } = require("mongodb");
const Model = require("../MongoDBReadModel");
const makeStore = require("../makeStore");

const { MONGODB = "mongodb://localhost:27017" } = process.env;

test("e2e", async () => {
  jest.setTimeout(10000);
  await clean("test_e2e");

  const incomingBatchedEvents = [
    [{ id: 1, type: "TEST_1" }],
    [
      { id: 2, type: "TEST_2" },
      { id: 3, type: "TEST_3" },
      { id: 4, type: "TEST_1" },
    ],
    [
      { id: 5, type: "TEST_3" },
      { id: 6, type: "TEST_4" },
    ],
    [{ id: 7, type: "TEST_5" }],
  ];

  const model = new Model({
    name: "collection_1",
    version: "e2e",
    transform: (event) =>
      [
        { insertOne: { event_type: event.type, counter: 0 } },
        event.type === "TEST_4" && {
          insertMany: [
            {
              y: 1,
            },
            {
              y: 2,
            },
            {
              y: 3,
            },
            {
              y: 4,
            },
          ],
        },
        {
          updateOne: {
            where: {
              event_type: "TEST_1",
            },
            change: {
              $inc: { counter: 1 },
            },
          },
        },
        {
          updateMany: {
            where: {
              counter: { $gte: 2 },
            },
            changes: {
              $addToSet: {
                array: { unique: event.id },
              },
            },
          },
        },
        event.type === "TEST_4" && {
          deleteOne: {
            where: {
              event_type: "TEST_3",
            },
          },
        },
        event.type === "TEST_5" && {
          deleteMany: {
            where: {
              y: { $gte: 3 },
            },
          },
        },
      ].filter((x) => x),
  });

  const pub = await makeStore({
    name: "e2e_db",
    url: MONGODB,
    dbName: "test_e2e",
    models: [model],
  });

  const sub = await makeStore({
    name: "e2e_db",
    url: MONGODB,
    dbName: "test_e2e",
    models: [model],
  });

  (async function () {
    for (const events of incomingBatchedEvents) {
      await sleep(10);
      await pub.handleEvents(events);
    }

    console.log("finished committing");
  })();

  const coll = await sub.getDriver(model);
  expect(await coll.countDocuments({})).toBe(0);

  for await (const checkpoint of sub.listen()) {
    if (checkpoint === 7) {
      const items = await coll.find({}).toArray();

      expect(items.map(({ _id, ...item }) => item)).toEqual([
        {
          __op: 3,
          __v: 7,
          counter: 7,
          event_type: "TEST_1",
          array: [
            { unique: 2 },
            { unique: 3 },
            { unique: 4 },
            { unique: 5 },
            { unique: 6 },
            { unique: 7 },
          ],
        },
        { __op: 0, __v: 2, counter: 0, event_type: "TEST_2" },
        { __op: 0, __v: 4, counter: 0, event_type: "TEST_1" },
        { __op: 0, __v: 5, counter: 0, event_type: "TEST_3" },
        { __op: 0, __v: 6, counter: 0, event_type: "TEST_4" },
        { __op: 1, __v: 6, y: 1 },
        { __op: 2, __v: 6, y: 2 },
        { __op: 0, __v: 7, counter: 0, event_type: "TEST_5" },
      ]);

      break;
    }
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function clean(dbName) {
  const client = await MongoClient.connect("mongodb://localhost:27017", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = client.db(dbName);
  await db.dropDatabase();
  await client.close();
}
