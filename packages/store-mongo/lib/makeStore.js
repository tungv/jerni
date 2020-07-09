const transform = require("./transform");
const JerniStoreMongoWriteError = require("./JerniStoreMongoWriteError");

const MongoClient = require("mongodb").MongoClient;

const SNAPSHOT_COLLECTION_NAME = "__snapshots_v1.0.0";

const AggregationSignal = require("./AggregationSignal");

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

  async function handleEvents(events, prevChanges = {}) {
    if (hasStopped) return {};
    const release = lock();
    try {
      // step 1 - get most recent updates for each collection
      const mostRecentByModelIndex = await Promise.all(
        models.map(async (model) => {
          // FIXME: this can be optimized by including all models in one request
          const coll = db.collection(getCollectionName(model));
          const [mostRecentlyUpdated] = await coll
            .find({}, { __v: 1, __op: 1 })
            .sort([
              ["__v", "desc"],
              ["__op", "desc"],
            ])
            .limit(1)
            .toArray();

          return mostRecentlyUpdated;
        }),
      );

      // step 2 - calculate all possible operators to apply on models
      const opsByModelIndex = Array.from({ length: models.length }, () => []);

      // keep track of aggregation signals
      const signals = [];
      let processedEventsCount = 0;
      try {
        events.forEach((event) => {
          const currentEventOpsByModelIndex = models.map(
            (model, modelIndex) => {
              return AggregationSignal.collect(
                db.collection(getCollectionName(model)),
                () => {
                  const { __v, __op } = mostRecentByModelIndex[modelIndex] || {
                    __v: 0,
                    __op: 0,
                  };
                  try {
                    return transform(model.transform, event, { __v, __op });
                  } catch (exceptionOrSignal) {
                    if (exceptionOrSignal instanceof AggregationSignal) {
                      signals.push(exceptionOrSignal);
                    }
                    return [];
                  }
                },
              );
            },
          );

          // stop collecting operations if there are some signals
          if (signals.length !== 0) {
            throw signals;
          }

          opsByModelIndex.forEach((ops, index) => {
            ops.push(...currentEventOpsByModelIndex[index]);
          });

          processedEventsCount++;
          AggregationSignal.cache.clear();
        });
      } catch (signals) {
        if (Array.isArray(signals)) {
          // ..
          // console.log(
          //   "%d pending signal found\n",
          //   signals.length,
          //   ...signals.map((sgn) => {
          //     return ` - ${sgn.collection.collectionName}\n`;
          //   }),
          // );
        } else {
          throw signals;
        }
      }

      // actual mongodb calls
      const allPromises = opsByModelIndex.map(async (ops, index) => {
        const model = models[index];
        const coll = db.collection(getCollectionName(model));
        const modelName = getCollectionName(model);

        if (ops.length === 0) return [modelName, null];

        try {
          const modelOpsResult = await coll.bulkWrite(ops);
          if (hasStopped) return {};
          const changes = {};
          if (modelOpsResult.nUpserted)
            changes.added = modelOpsResult.nUpserted;
          if (modelOpsResult.nModified)
            changes.modified = modelOpsResult.nModified;
          if (modelOpsResult.nRemoved)
            changes.removed = modelOpsResult.nRemoved;

          return [modelName, changes];
        } catch (bulkWriteError) {
          throw new JerniStoreMongoWriteError(bulkWriteError, model);
        }
      });

      await snapshotsCol.findOneAndUpdate(
        {
          $and: [
            {
              $or: models.map((model) => ({
                name: model.name,
                version: model.version,
              })),
            },
            { __v: { $lt: events[events.length - 1].id } },
          ],
        },
        {
          $set: { __v: events[events.length - 1].id },
        },
      );

      const pairs = await Promise.all(allPromises);
      if (hasStopped) return {};

      const partialChanges = Object.fromEntries(
        pairs
          .map((collName, changes) => [
            collName,
            (prevChanges[collName] || 0) + (changes || 0),
          ])
          .filter(([collName, changes]) => changes),
      );

      // priming values for signals
      if (signals.length) {
        for (const signal of signals) {
          await signal.prime((model) =>
            db.collection(getCollectionName(model)),
          );
        }

        // retry
        release();
        return await handleEvents(
          events.slice(processedEventsCount),
          partialChanges,
        );
      }

      return partialChanges;
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

    models.forEach((model) => {
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

      modelSpecificMeta.includes.forEach((type) => includes.add(type));
    });

    if (includesAll) {
      store.meta.includes = [];
    } else {
      store.meta.includes = Array.from(includes);
    }
  }

  async function getLastSeenId() {
    if (hasStopped) return 0;
    const condition = {
      $or: models.map((m) => ({ name: m.name, version: m.version })),
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

    const oldestVersion = Math.min(...resp.map((obj) => obj.__v));
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
    const promises = models.map((m) => {
      const col = db.collection(getCollectionName(m));
      return col.deleteMany({});
    });

    const condition = {
      $or: models.map((m) => ({ name: m.name, version: m.version })),
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
