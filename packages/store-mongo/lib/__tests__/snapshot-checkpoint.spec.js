const mongodb = require("mongodb");
const makeStore = require("../makeStore");
const { MongoClient } = mongodb;

const URL = "mongodb://localhost:27017";
const SNAPSHOT_COLLECTION_NAME = "__snapshots_v1.0.0";

describe("getLastSeenId() snapshot checkpoint", () => {
  it("Bug 1: detects a model with no snapshot doc even when another model has duplicate docs", async () => {
    const dbName = "test_snapshot_bug1";
    await dropDb(dbName);

    const models = [model("model_a"), model("model_b"), model("model_c")];

    // Pre-seed snapshots: model_a has TWO docs (duplicate), model_b has one,
    // model_c has none. `resp.length` (3) now equals `models.length` (3), which
    // is what fooled the old raw-count comparison.
    await withSnapshots(dbName, async (col) => {
      await col.insertMany([
        { name: "model_a", version: "1.0.0", __v: 10 },
        { name: "model_a", version: "1.0.0", __v: 10 },
        { name: "model_b", version: "1.0.0", __v: 20 },
      ]);
    });

    const store = await makeStore({ name: dbName, url: URL, dbName, models });

    // model_c is missing a doc -> must reset to 0 and create the missing doc
    expect(await store.getLastSeenId()).toBe(0);

    await withSnapshots(dbName, async (col) => {
      const cDoc = await col.findOne({ name: "model_c", version: "1.0.0" });
      expect(cDoc).toMatchObject({ __v: 0 });
    });

    // once every model has a doc, the checkpoint is the oldest __v (0 here)
    expect(await store.getLastSeenId()).toBe(0);

    await store.dispose();
  });

  it("Bug 2: concurrent calls at startup do not each run the create-missing-docs loop", async () => {
    const dbName = "test_snapshot_bug2";
    await dropDb(dbName);

    const models = [model("model_a"), model("model_b")];
    const spy = spyOnSnapshotUpserts();

    try {
      const store = await makeStore({ name: dbName, url: URL, dbName, models });

      // Two independent, unsynchronized call sites at startup both resolve to
      // store.getLastSeenId(); simulate that with concurrent invocations.
      const results = await Promise.all([
        store.getLastSeenId(),
        store.getLastSeenId(),
        store.getLastSeenId(),
        store.getLastSeenId(),
      ]);

      expect(results).toEqual([0, 0, 0, 0]);

      // the create-missing-docs loop must run for each model at most once in
      // total, not once per concurrent caller
      expect(spy.count).toBeLessThanOrEqual(models.length);

      await withSnapshots(dbName, async (col) => {
        const docs = await col.find({}).toArray();
        expect(docs).toHaveLength(models.length);
      });

      await store.dispose();
    } finally {
      spy.restore();
    }
  });
});

function model(name) {
  return {
    name,
    version: "1.0.0",
    transform(event) {
      return [{ insertOne: { _id: event.id } }];
    },
  };
}

function spyOnSnapshotUpserts() {
  const proto = mongodb.Collection.prototype;
  const original = proto.findOneAndUpdate;
  const spy = {
    count: 0,
    restore() {
      proto.findOneAndUpdate = original;
    },
  };
  proto.findOneAndUpdate = function(...args) {
    if (this.collectionName === SNAPSHOT_COLLECTION_NAME) spy.count++;
    return original.apply(this, args);
  };
  return spy;
}

async function dropDb(dbName) {
  const client = await MongoClient.connect(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.db(dbName).dropDatabase();
  await client.close();
}

async function withSnapshots(dbName, fn) {
  const client = await MongoClient.connect(URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    await fn(client.db(dbName).collection(SNAPSHOT_COLLECTION_NAME));
  } finally {
    await client.close();
  }
}
