const mongodb = require("mongodb");
const makeStore = require("../makeStore");
const { MongoClient } = mongodb;

const URL = "mongodb://localhost:27017";
const SNAPSHOT_COLLECTION_NAME = "__snapshots_v1.0.0";

describe("getLastSeenId() snapshot checkpoint", () => {
  it("detects a model with no snapshot doc even when another model has duplicate docs", async () => {
    const dbName = "test_snapshot_dup_docs";
    await dropDb(dbName);

    const models = [model("model_a"), model("model_b"), model("model_c")];

    // model_a has two docs, model_b one, model_c none: resp.length (3) equals
    // models.length (3), so a raw-count check would miss model_c
    await withSnapshots(dbName, async (col) => {
      await col.insertMany([
        { name: "model_a", version: "1.0.0", __v: 10 },
        { name: "model_a", version: "1.0.0", __v: 10 },
        { name: "model_b", version: "1.0.0", __v: 20 },
      ]);
    });

    const store = await makeStore({ name: dbName, url: URL, dbName, models });

    // model_c has no doc: reset to 0 and create it
    expect(await store.getLastSeenId()).toBe(0);

    await withSnapshots(dbName, async (col) => {
      const cDoc = await col.findOne({ name: "model_c", version: "1.0.0" });
      expect(cDoc).toMatchObject({ __v: 0 });
    });

    // every model now has a doc: checkpoint is the oldest __v
    expect(await store.getLastSeenId()).toBe(0);

    await store.dispose();
  });

  it("does not create duplicate snapshot docs when called concurrently at startup", async () => {
    const dbName = "test_snapshot_concurrent";
    await dropDb(dbName);

    const models = [model("model_a"), model("model_b")];
    const spy = spyOnSnapshotReads();

    try {
      const store = await makeStore({ name: dbName, url: URL, dbName, models });

      // startup resolves getLastSeenId() from two unsynchronized call sites
      const results = await Promise.all([
        store.getLastSeenId(),
        store.getLastSeenId(),
        store.getLastSeenId(),
        store.getLastSeenId(),
      ]);

      expect(results).toEqual([0, 0, 0, 0]);

      // concurrent callers share one computation instead of each racing to
      // read the snapshot collection and create the missing docs
      expect(spy.count).toBe(1);

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

// computeLastSeenId() reads the snapshot collection exactly once per run, so
// the number of reads tells us how many times the computation actually ran
function spyOnSnapshotReads() {
  const proto = mongodb.Collection.prototype;
  const original = proto.find;
  const spy = {
    count: 0,
    restore() {
      proto.find = original;
    },
  };
  proto.find = function(...args) {
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
