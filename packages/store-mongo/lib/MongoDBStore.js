const MongoHeartbeat = require("mongo-heartbeat");
const PLazy = require("p-lazy");
const Store = require("@jerni/base/Store");
const kefir = require("kefir");

const { DEV__clean, createCommitter, createSubscriber } = require("./queue");

const DEBUG = process.env.DEBUG === "true";
const MongoClient = require("mongodb").MongoClient;
const transform = require("./transform");

const SNAPSHOT_COLLECTION_NAME = "__snapshots_v1.0.0";

const flatten = arrayDeep => [].concat(...arrayDeep);

const connect = async url => {
  const client = await MongoClient.connect(url, {
    useNewUrlParser: true,
    reconnectTries: Number.MAX_VALUE,
  });
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
      count: 100,
    },
  }) {
    super({ name, models, url });
    this.buffer = buffer;
    this.listeners = [];
    this.connectionInfo = {
      url,
      dbName,
    };
    this.openConnections = [];

    this.connection = null;

    this.keepConnection(conn => {
      this.connection = conn;

      const hb = MongoHeartbeat(conn.db, {
        interval: 60 * 1000,
        timeout: 10000,
        tolerance: 3,
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
      buffer: this.buffer,
    };
  }

  async getLastSeenId() {
    return this.useConnection(async conn => {
      const condition = {
        $or: this.models.map(m => ({ name: m.name, version: m.version })),
      };

      const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);
      const resp = await snapshotsCol.find(condition).toArray();

      if (resp.length < this.models.length) {
        for (const model of this.models) {
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
    });
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
    DEBUG && console.info("cleaning [start]");

    await this.useConnection(async ({ db }) => {
      await DEV__clean(db);
      const promises = this.models.map(m => {
        const col = db.collection(m.collectionName);
        return col.deleteMany({});
      });

      const condition = {
        $or: this.models.map(m => ({ name: m.name, version: m.version })),
      };

      promises.push(
        db.collection(SNAPSHOT_COLLECTION_NAME).deleteMany(condition),
      );

      try {
        await Promise.all(promises);
      } finally {
        DEBUG && console.info("cleaning [completed]");
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
      const subscribe = await createSubscriber(conn.db, this.models);

      subscribe(id => {
        DEBUG && console.debug("arrived_event", id);
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
    DEBUG && console.log("receive");
    return this.keepConnection(conn => {
      const commitPromise = createCommitter(conn.db);

      const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);

      const transformEvent = events =>
        new PLazy(resolve => {
          const latestId = events[events.length - 1].id;
          const allPromises = this.models.map(async model => {
            const ops = flatten(
              events.map(event => {
                try {
                  return transform(model.transform, event);
                } catch (ex) {
                  return [];
                }
              }),
            );

            let changes = {
              model,
              added: 0,
              modified: 0,
              removed: 0,
            };

            if (ops.length > 0) {
              const coll = conn.db.collection(model.collectionName);
              const modelOpsResult = await coll.bulkWrite(ops);
              changes = {
                model,
                added: modelOpsResult.nUpserted,
                modified: modelOpsResult.nModified,
                removed: modelOpsResult.nRemoved,
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
          });

          return Promise.all(allPromises).then(changesByModels => {
            return commitPromise
              .then(commit =>
                commit({
                  source: this.name,
                  models: this.models,
                  event_id: latestId,
                }),
              )
              .then(() => {
                resolve({
                  events,
                  models: changesByModels,
                });
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
