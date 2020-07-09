const makeStore = require("../makeStore");
const { MongoClient } = require("mongodb");

const AggregationSignal = require("../AggregationSignal");

function useAggregate(pipeline) {
  const signal = new AggregationSignal(pipeline, {});
  const results = signal.results();

  if (results) {
    return results;
  }
  throw signal;
}

function useCount(condition) {
  const result = useAggregate([{ $match: condition }, { $count: "count" }]);

  if (result.length === 0) return 0;
  return result[0].count;
}

describe("useAggregate(pipeline, opts)", () => {
  test("single hooks inside transform", async () => {
    await clean("aggregate_match");

    const model = {
      name: "model",
      version: "1",
      transform(event) {
        const result = useAggregate([
          { $match: { username: event.payload.username } },
          { $count: "count" },
        ]);

        const duplicate = result.length !== 0;

        return [
          {
            insertOne: {
              username: event.payload.username,
              activated: !duplicate,
            },
          },
        ];
      },
    };

    const store = await makeStore({
      name: "aggregate_match",
      url: "mongodb://localhost:27017",
      dbName: "aggregate_match",
      models: [model],
    });

    try {
      await store.handleEvents([
        { id: 1, type: "user_registered", payload: { username: "1" } },
        { id: 2, type: "user_registered", payload: { username: "2" } },
        { id: 3, type: "user_registered", payload: { username: "1" } },
      ]);

      const coll = await store.getDriver(model);
      const rows = await coll.find({}).toArray();

      expect(rows).toEqual([
        {
          __op: 0,
          __v: 1,
          _id: expect.any(Object),
          username: "1",
          activated: true,
        },
        {
          __op: 0,
          __v: 2,
          _id: expect.any(Object),
          username: "2",
          activated: true,
        },
        {
          __op: 0,
          __v: 3,
          _id: expect.any(Object),
          username: "1",
          activated: false,
        },
      ]);
    } finally {
      await store.dispose();
    }
  });

  test("composable hooks", async () => {
    await clean("hooks_composable");

    const model = {
      name: "model",
      version: "1",
      transform(event) {
        const count = useCount({ username: event.payload.username });

        return [
          {
            insertOne: {
              username: event.payload.username,
              activated: count === 0,
            },
          },
        ];
      },
    };

    const store = await makeStore({
      name: "hooks_composable",
      url: "mongodb://localhost:27017",
      dbName: "hooks_composable",
      models: [model],
    });

    try {
      await store.handleEvents([
        { id: 1, type: "user_registered", payload: { username: "1" } },
        { id: 2, type: "user_registered", payload: { username: "1" } },
      ]);

      const coll = await store.getDriver(model);
      const rows = await coll.find({}).toArray();

      expect(rows).toEqual([
        {
          __op: 0,
          __v: 1,
          _id: expect.any(Object),
          username: "1",
          activated: true,
        },
        {
          __op: 0,
          __v: 2,
          _id: expect.any(Object),
          username: "1",
          activated: false,
        },
      ]);
    } finally {
      await store.dispose();
    }
  });

  test("multiple models", async () => {
    await clean("hooks_multiple_models");

    const model1 = {
      name: "users",
      version: "1",
      transform: limit(6, function (event) {
        const count = useCount({ username: event.payload.username });

        return [
          {
            insertOne: {
              username: event.payload.username,
              activated: count === 0,
            },
          },
        ];
      }),
    };
    const model2 = {
      name: "groups",
      version: "2",
      transform: limit(6, function (event) {
        const count = useCount({ group: event.payload.group });

        return [
          {
            insertOne: {
              group: event.payload.group,
              activated: count === 0,
            },
          },
        ];
      }),
    };

    const store = await makeStore({
      name: "hooks_multiple_models",
      url: "mongodb://localhost:27017",
      dbName: "hooks_multiple_models",
      models: [model1, model2],
    });

    try {
      await store.handleEvents([
        {
          id: 1,
          type: "user_registered",
          payload: { username: "1", group: 1 },
        },
        {
          id: 2,
          type: "user_registered",
          payload: { username: "2", group: 1 },
        },
        {
          id: 3,
          type: "user_registered",
          payload: { username: "1", group: 2 },
        },
      ]);

      const Users = await store.getDriver(model1);
      const Groups = await store.getDriver(model2);
      const users = await Users.find({}).toArray();
      const groups = await Groups.find({}).toArray();

      expect(users).toEqual([
        {
          __op: 0,
          __v: 1,
          _id: expect.any(Object),
          username: "1",
          activated: true,
        },
        {
          __op: 0,
          __v: 2,
          _id: expect.any(Object),
          username: "2",
          activated: true,
        },
        {
          __op: 0,
          __v: 3,
          _id: expect.any(Object),
          username: "1",
          activated: false,
        },
      ]);
      expect(groups).toEqual([
        {
          __op: 0,
          __v: 1,
          _id: expect.any(Object),
          group: 1,
          activated: true,
        },
        {
          __op: 0,
          __v: 2,
          _id: expect.any(Object),
          group: 1,
          activated: false,
        },
        {
          __op: 0,
          __v: 3,
          _id: expect.any(Object),
          group: 2,
          activated: true,
        },
      ]);
    } finally {
      await store.dispose();
    }
  });
});

async function clean(dbName) {
  const client = await MongoClient.connect("mongodb://localhost:27017", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const db = client.db(dbName);
  await db.dropDatabase();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function limit(times, fn) {
  let elapsed = 0;
  return function (...args) {
    elapsed++;

    if (elapsed > times) {
      throw new Error("exceeding maximum calls of " + times);
    }
    return fn(...args);
  };
}
