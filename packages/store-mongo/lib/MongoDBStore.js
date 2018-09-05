const log4js = require("log4js");
const logger = log4js.getLogger("@jerni/store-mongo");

if (process.env.NODE_ENV === "production") {
  logger.level = "info";
} else {
  logger.level = "debug";
}

const MongoHeartbeat = require("mongo-heartbeat");

const Store = require("@jerni/base/Store");
const PLazy = require("p-lazy");
const kefir = require("kefir");

const MongoClient = require("mongodb").MongoClient;
const makeDefer = require("./makeDefer");
const watch = require("./watch");
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

    this.connected = makeDefer();

    this.actuallyConnect().then(async conn => {
      this.connection = conn;
      this.connected.resolve();
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

  async clean() {
    await this.connected.promise;

    const { db } = this.connection;
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

    await Promise.all(promises);
  }

  async actuallyConnect() {
    try {
      const client = await connect(this.connectionInfo.url);

      if (process.env.NODE_ENV === "production") {
        // minimal logging
        client.on("close", () => {
          logger.info("connection closed");
        });
        client.on("reconnect", () => {
          logger.info("connection reconnected");
        });
      } else {
        [
          "connect",
          "reconnect",
          "serverOpening",
          "serverClosed",
          "serverDescriptionChanged",
          "topologyOpening",
          "topologyClosed",
          "topologyDescriptionChanged",
          "reconnectFailed",
          "close",
          "error",
          "destroy"
        ].forEach(evt =>
          client.on(evt, () => {
            logger.debug(evt);
          })
        );
      }

      const db = client.db(this.connectionInfo.dbName);
      const hb = MongoHeartbeat(db, {
        interval: 60 * 1000,
        timeout: 10000,
        tolerance: 3
      });

      hb.on("error", err => {
        console.error("mongodb didnt respond the heartbeat message");
        process.nextTick(function() {
          process.exit(1);
        });
      });
      return { client, db };
    } catch (ex) {
      console.error(ex);
      process.exit(1);
    }
  }

  async getDriver(model) {
    await this.connected.promise;

    return this.connection.db.collection(model.collectionName);
  }

  watch() {
    if (this.watching) return;

    this.watching = true;
    const conn = this.connection;
    // get change stream from __snapshots collection
    const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);

    const change$ = watch(conn.client, snapshotsCol, this.models);
    change$.observe(id => {
      this.lastReceivedEventId = id;
      this.listeners.forEach(fn => fn(id));
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
    await this.connected.promise;

    const conn = this.connection;

    const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);

    const transformEvent = events =>
      new PLazy(resolve => {
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

          if (ops.length === 0) {
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
