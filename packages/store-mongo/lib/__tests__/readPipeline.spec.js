const makeStore = require("../makeStore");
const { MongoClient } = require("mongodb");
const readPipeline = require("../readPipeline");
const MongoDBReadModel = require("../MongoDBReadModel");

function readCount(condition) {
  const result = readPipeline([{ $match: condition }, { $count: "count" }]);

  if (result.length === 0) return 0;
  return result[0].count;
}

describe("readPipeline(pipeline, opts)", () => {
  test("single hooks inside transform", async () => {
    await clean("aggregate_match");

    const model = {
      name: "model",
      version: "1",
      transform(event) {
        const result = readPipeline([
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
        const count = readCount({ username: event.payload.username });

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
      transform: limit(10, function (event) {
        const count = readCount({ username: event.payload.username });

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
      transform: limit(10, function (event) {
        const ops = event.payload.groups.flatMap((id) => {
          const count = readCount({ id });

          if (count === 0) {
            return [
              {
                insertOne: { id, usernames: [event.payload.username] },
              },
            ];
          }

          return [
            {
              updateOne: {
                where: { id },
                changes: {
                  $push: {
                    usernames: event.payload.username,
                  },
                },
              },
            },
          ];
        });

        return ops;
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
          payload: { username: "1", groups: [1] },
        },
        {
          id: 2,
          type: "user_registered",
          payload: { username: "2", groups: [1, 2] },
        },
        {
          id: 3,
          type: "user_registered",
          payload: { username: "1", groups: [2, 3] },
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
          __v: 2,
          _id: expect.any(Object),
          id: 1,
          usernames: ["1", "2"],
        },
        {
          __op: 0,
          __v: 3,
          _id: expect.any(Object),
          id: 2,
          usernames: ["2", "1"],
        },
        {
          __op: 1,
          __v: 3,
          _id: expect.any(Object),
          id: 3,
          usernames: ["1"],
        },
      ]);
    } finally {
      await store.dispose();
    }
  });

  test("cross model pipeline", async () => {
    await clean("hooks_cross_model");

    function readFindOne(model, condition) {
      const result = readPipeline(model, [
        { $match: condition },
        { $limit: 1 },
      ]);

      if (!result) return null;
      return result[0];
    }

    const itemModel = new MongoDBReadModel({
      name: "items",
      version: "1",
      transform: limit(20, function (event) {
        if (event.type === "item_added") {
          return [
            {
              insertOne: {
                id: event.payload.id,
                name: event.payload.name,
              },
            },
          ];
        }
      }),
    });
    const listModel = new MongoDBReadModel({
      name: "lists",
      version: "1",
      transform: limit(20, function (event) {
        if (event.type === "list_created") {
          return [
            {
              insertOne: {
                id: event.payload.id,
                listName: event.payload.name,
                items: [],
              },
            },
          ];
        }

        if (event.type === "list_appended") {
          const item = readFindOne(itemModel, { id: event.payload.itemId });
          return [
            {
              updateOne: {
                where: { id: event.payload.listId },
                changes: {
                  $push: {
                    items: { id: item.id, name: item.name },
                  },
                },
              },
            },
          ];
        }
      }),
    });

    const store = await makeStore({
      name: "hooks_cross_model",
      url: "mongodb://localhost:27017",
      dbName: "hooks_cross_model",
      models: [itemModel, listModel],
    });

    try {
      await store.handleEvents([
        // create 3 items
        { id: 1, type: "item_added", payload: { id: 1, name: "item 1" } },
        { id: 2, type: "item_added", payload: { id: 2, name: "item 2" } },
        { id: 3, type: "item_added", payload: { id: 3, name: "item 3" } },

        // create a list
        { id: 4, type: "list_created", payload: { id: 1, name: "list 1" } },

        // append to list
        { id: 5, type: "list_appended", payload: { listId: 1, itemId: 1 } },
        { id: 6, type: "list_appended", payload: { listId: 1, itemId: 2 } },
      ]);

      const List = await store.getDriver(listModel);

      const lists = await List.find({}).toArray();

      expect(lists).toEqual([
        {
          __op: 0,
          __v: 6,
          _id: expect.any(Object),
          id: 1,
          listName: "list 1",
          items: [
            { id: 1, name: "item 1" },
            { id: 2, name: "item 2" },
          ],
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
  await client.close();
}

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
