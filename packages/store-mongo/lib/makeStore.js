const transform = require("./transform");

const MongoClient = require("mongodb").MongoClient;

const SNAPSHOT_COLLECTION_NAME = "__snapshots_v1.0.0";

module.exports = async function makeStore(config = {}) {
  const { name, url, dbName, models } = config;
  const lock = locker();

  const client = await connect(url);
  const db = client.db(dbName);
  const snapshotsCol = db.collection(SNAPSHOT_COLLECTION_NAME);
  let hasStopped = false;

  const store = {
    meta: {},
    name,
    registerModels,
    getDriver,
    handleEvents,
    getLastSeenId,
    listen,
    clean,
    toString() {
      return url;
    },
    dispose,
  };

  return store;

  async function dispose() {
    hasStopped = true;
    await client.close();
  }

  async function handleEvents(events) {
    if (hasStopped) return {};
    const release = lock();
    try {
      const allPromises = models.map(async model => [
        getCollectionName(model),
        await executeOpsOnOneModel(model, events),
      ]);

      const pairs = await Promise.all(allPromises);
      if (hasStopped) return {};
      return Object.fromEntries(pairs.filter(([collName, changes]) => changes));
    } finally {
      release();
    }
  }

  async function getDriver(model) {
    return db.collection(getCollectionName(model));
  }

  function getCollectionName(model) {
    return `${model.name}_v${model.version}`;
  }

  function registerModels(map) {
    let includes = new Set();
    let includesAll = false;

    models.forEach(model => {
      map.set(model, store);

      // handle meta.includes
      const modelSpecificMeta = model.meta || model.transform.meta;
      if (
        !modelSpecificMeta ||
        !modelSpecificMeta.includes ||
        modelSpecificMeta.includes.length === 0
      ) {
        includesAll = true;
        return;
      }

      modelSpecificMeta.includes.forEach(type => includes.add(type));
    });

    if (includesAll) {
      store.meta.includes = [];
    } else {
      store.meta.includes = Array.from(includes);
    }
  }

  async function executeOpsOnOneModel(model, events) {
    if (hasStopped) return {};
    const ops = [].concat(
      ...events.map(event => {
        try {
          return transform(model.transform, event);
        } catch (ex) {
          return [];
        }
      }),
    );

    let changes = null;

    if (ops.length > 0) {
      const coll = db.collection(getCollectionName(model));
      const modelOpsResult = await coll.bulkWrite(ops);
      if (hasStopped) return {};
      changes = {};
      if (modelOpsResult.nUpserted) changes.added = modelOpsResult.nUpserted;
      if (modelOpsResult.nModified) changes.modified = modelOpsResult.nModified;
      if (modelOpsResult.nRemoved) changes.removed = modelOpsResult.nRemoved;
    }

    await snapshotsCol.findOneAndUpdate(
      {
        name: model.name,
        version: model.version,
        __v: { $lt: events[events.length - 1].id },
      },
      {
        $set: { __v: events[events.length - 1].id },
      },
    );

    return changes;
  }

  async function getLastSeenId() {
    if (hasStopped) return 0;
    const condition = {
      $or: models.map(m => ({ name: m.name, version: m.version })),
    };

    const snapshotsCol = db.collection(SNAPSHOT_COLLECTION_NAME);
    const resp = await snapshotsCol.find(condition).toArray();
    if (hasStopped) return 0;

    if (resp.length < models.length) {
      for (const model of models) {
        await snapshotsCol.findOneAndUpdate(
          {
            name: model.name,
            version: model.version,
          },
          { $setOnInsert: { __v: 0 } },
          {
            upsert: true,
          },
        );
        if (hasStopped) return 0;
      }
      return 0;
    }

    const oldestVersion = Math.min(...resp.map(obj => obj.__v));
    return oldestVersion;
  }

  async function* listen() {
    while (!hasStopped) {
      const next = await getLastSeenId();
      yield next;
      await sleep(300);
    }
  }

  async function clean() {
    if (hasStopped) return;
    const promises = models.map(m => {
      const col = db.collection(getCollectionName(m));
      return col.deleteMany({});
    });

    const condition = {
      $or: models.map(m => ({ name: m.name, version: m.version })),
    };

    promises.push(snapshotsCol.deleteMany(condition));

    try {
      await Promise.all(promises);
      if (hasStopped) return;
    } catch (ex) {
      console.error(ex);
    }
  }
};

async function connect(url) {
  const client = await MongoClient.connect(url, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  });
  return client;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function locker() {
  let on = false;

  return () => {
    if (on) {
      throw new Error("this function is locked and cannot run");
    }
    on = true;

    return () => {
      on = false;
    };
  };
}
