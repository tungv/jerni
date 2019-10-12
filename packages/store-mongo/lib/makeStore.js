const transform = require("./transform");

const MongoClient = require("mongodb").MongoClient;

const SNAPSHOT_COLLECTION_NAME = "__snapshots_v1.0.0";

module.exports = async function makeStore(config = {}) {
  const { name, url, dbName, models, dev = false } = config;
  let listeners = [];
  const lock = locker();

  const client = await connect(url);
  const db = client.db(dbName);
  const snapshotsCol = db.collection(SNAPSHOT_COLLECTION_NAME);

  const store = {
    meta: {},
    name,
    registerModels,
    subscribe,
    getDriver,
    handleEvents,
    getLastSeenId,
    listen,
  };

  if (dev) {
    store.DEV_clean = clean;
  }

  return store;

  async function handleEvents(events) {
    const release = lock();
    try {
      const allPromises = models.map(async model => [
        getCollectionName(model),
        await executeOpsOnOneModel(model, events),
      ]);

      const pairs = await Promise.all(allPromises);
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

  function subscribe(listener) {
    listeners.push(listeners);

    return () => {
      listeners = listeners.filter(fn => fn !== listener);
    };
  }
  function registerModels(map) {
    let includes = new Set();
    let includesAll = false;
    models.forEach(model => {
      map.set(store, model);

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

      includes.add(...modelSpecificMeta.includes);
    });

    if (includesAll) {
      store.meta.includes = [];
    } else {
      store.meta.includes = Array.from(includes);
    }
  }

  async function executeOpsOnOneModel(model, events) {
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
      changes = {
        added: modelOpsResult.nUpserted || undefined,
        modified: modelOpsResult.nModified || undefined,
        removed: modelOpsResult.nRemoved || undefined,
      };
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
    const condition = {
      $or: models.map(m => ({ name: m.name, version: m.version })),
    };

    const snapshotsCol = db.collection(SNAPSHOT_COLLECTION_NAME);
    const resp = await snapshotsCol.find(condition).toArray();

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
      }
      return 0;
    }

    const oldestVersion = Math.min(...resp.map(obj => obj.__v));
    return oldestVersion;
  }

  async function* listen() {
    while (true) {
      yield await getLastSeenId();
      await sleep(500);
    }
  }

  async function clean() {
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
    } finally {
      console.info("cleaning [completed]");
    }
  }
};

async function connect(url) {
  const client = await MongoClient.connect(url, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    reconnectTries: Number.MAX_VALUE,
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
