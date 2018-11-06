const MongoHeartbeat = require("mongo-heartbeat");
const PLazy = require("p-lazy");
const Store = require("@jerni/base/Store");
const kefir = require("kefir");
const log4js = require("log4js");

const { DEV__clean, createCommitter, createSubscriber } = require("./queue");

const logger = log4js.getLogger("jerni/store-mongo");

const MongoClient = require("mongodb").MongoClient;
const transform = require("./transform");

const SNAPSHOT_COLLECTION_NAME = "__snapshots_v1.0.0";

const flatten = arrayDeep => [].concat(...arrayDeep);

const connect = async url => {
  const client = await MongoClient.connect(
    url,
    { useNewUrlParser: true, reconnectTries: Number.MAX_VALUE }
  );
  return client;
};

module.exports = class MongoDBStore extends Store {
  constructor({
    name,
    url,
    dbName,
    models,
    buffer = {
      time: 2,
      count: 100
    }
  }) {
    super({ name, models, url });
    this.buffer = buffer;
    this.listeners = [];
    this.connectionInfo = {
      url,
      dbName
    };
    this.openConnections = [];

    this.connection = null;

    this.keepConnection(conn => {
      this.connection = conn;

      const hb = MongoHeartbeat(conn.db, {
        interval: 60 * 1000,
        timeout: 10000,
        tolerance: 3
      });

      hb.on("error", err => {
        process.nextTick(function() {
          process.exit(1);
        });
      });
    });
  }

  toJSON() {
    return {
      name: this.name,
      url: this.url,
      dbName: this.dbName,
      buffer: this.buffer
    };
  }

  async getLastSeenId() {
    await this.connected.promise;
    const condition = {
      $or: this.models.map(m => ({ name: m.name, version: m.version }))
    };

    const conn = this.connection;
    const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);
    const resp = await snapshotsCol.find(condition).toArray();

    const oldestVersion = resp.reduce((v, obj) => {
      if (obj.__v > v) {
        return obj.__v;
      }
      return v;
    }, 0);
    return oldestVersion;
  }

  async useConnection(computation) {
    let client = null;
    try {
      client = await connect(this.connectionInfo.url);
      const db = client.db(this.connectionInfo.dbName);
      return await computation({ client, db });
    } finally {
      client && client.close();
    }
  }

  async keepConnection(computation) {
    const client = await connect(this.connectionInfo.url);
    const db = client.db(this.connectionInfo.dbName);
    this.openConnections.push(client);
    return computation({ client, db });
  }

  async clean() {
    logger.info("cleaning [start]");

    await this.useConnection(async ({ db }) => {
      await DEV__clean(db);
      const promises = this.models.map(m => {
        const col = db.collection(m.collectionName);
        return col.deleteMany({});
      });

      const condition = {
        $or: this.models.map(m => ({ name: m.name, version: m.version }))
      };

      promises.push(
        db.collection(SNAPSHOT_COLLECTION_NAME).deleteMany(condition)
      );

      try {
        await Promise.all(promises);
      } finally {
        logger.info("cleaning [completed]");
      }
    });
  }

  async getDriver(model) {
    return this.connection.db.collection(model.collectionName);
  }

  watch() {
    if (this.watching) return;

    this.watching = true;

    this.keepConnection(async conn => {
      // get change stream from __snapshots collection
      const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);
      const subscribe = await createSubscriber(conn.db, this.models);

      subscribe(id => {
        logger.debug("arrived_event", id);
        if (!this.lastReceivedEventId || this.lastReceivedEventId < id) {
          this.lastReceivedEventId = id;
          this.listeners.forEach(fn => fn(id));
        }
      });
    });
  }

  subscribe(fn) {
    this.listeners.push(fn);

    this.watch();

    // unsubscribe
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  async receive(kefirStreamOfBatchedEvents) {
    return this.keepConnection(async conn => {
      const commit = await createCommitter(conn.db);

      const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);

      const transformEvent = events =>
        new PLazy(resolve => {
          logger.trace("transforming events", events);
          const allPromises = this.models.map(async model => {
            const ops = flatten(
              events.map(event => {
                try {
                  return transform(model.transform, event);
                } catch (ex) {
                  return [];
                }
              })
            );

            const latestId = events[events.length - 1].id;
            if (ops.length === 0) {
              await snapshotsCol.findOneAndUpdate(
                {
                  name: model.name,
                  version: model.version
                },
                {
                  $set: { __v: latestId }
                },
                {
                  upsert: true
                }
              );

              await commit({
                source: this.name,
                model: model.name,
                model_version: model.version,
                event_id: latestId
              });
              return {
                model,
                added: 0,
                modified: 0,
                removed: 0
              };
            }

            const coll = conn.db.collection(model.collectionName);
            const modelOpsResult = await coll.bulkWrite(ops);

            await snapshotsCol.findOneAndUpdate(
              {
                name: model.name,
                version: model.version
              },
              {
                $set: { __v: events[events.length - 1].id }
              },
              {
                upsert: true
              }
            );
            await commit({
              source: this.name,
              model: model.name,
              model_version: model.version,
              event_id: latestId
            });

            return {
              model,
              added: modelOpsResult.nUpserted,
              modified: modelOpsResult.nModified,
              removed: modelOpsResult.nRemoved
            };
          });

          return Promise.all(allPromises).then(changesByModels => {
            resolve({
              events,
              models: changesByModels
            });
          });
        });

      return kefirStreamOfBatchedEvents
        .flatten()
        .bufferWithTimeOrCount(this.buffer.time, this.buffer.count)
        .filter(buf => buf.length)
        .flatMapConcat(events => kefir.fromPromise(transformEvent(events)));
    });
  }

  dispose() {
    this.openConnections.forEach(client => client.close(true));
  }
};

const once = fn => {
  let tries = 0;
  return (...args) => {
    if (!tries++) {
      return fn(...args);
    }
  };
};
