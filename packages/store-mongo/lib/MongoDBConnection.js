const Connection = require('heq-store/lib/Connection');
const kefir = require('kefir');
const PLazy = require('p-lazy');
const MongoClient = require('mongodb').MongoClient;
const makeDefer = require('./makeDefer');
const SNAPSHOT_COLLECTION_NAME = '__snapshots_v1.0.0';
const { watchWithoutReplicaSet } = require('./watch');
const transform = require('./transform');

module.exports = class MongoDBConnection extends Connection {
  constructor({ name, url, dbName, models }) {
    super({ name });
    this.models = models;
    this.listeners = [];
    this.connectionInfo = {
      url,
      dbName,
    };

    this.connected = makeDefer();

    this.actuallyConnect().then(async conn => {
      this.connection = conn;

      this.connected.resolve();

      // get change stream from __snapshots collection
      const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);

      const change$ = watchWithoutReplicaSet(snapshotsCol, this.models);

      change$.observe(id => {
        this.listeners.forEach(fn => fn(id));
      });
    });
  }

  async clean() {
    await this.connected.promise;

    const { db } = this.connection;
    const promises = this.models.map(m => {
      const col = db.collection(m.collectionName);
      return col.deleteMany({});
    });

    await Promise.all(promises);
  }

  async actuallyConnect() {
    const {
      connectionInfo: { url, dbName },
    } = this;
    const client = await MongoClient.connect(
      url,
      { useNewUrlParser: true }
    );
    const db = client.db(dbName);

    return { client, db };
  }

  async getDriver(model) {
    await this.connected.promise;

    return this.connection.db.collection(model.collectionName);
  }

  subscribe(fn) {
    this.listeners.push(fn);

    // unsubscribe
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  async receive(kefirStreamOfBatchedEvents) {
    await this.connected.promise;

    const conn = this.connection;

    const snapshotsCol = conn.db.collection(SNAPSHOT_COLLECTION_NAME);

    const transformEvent = event =>
      new PLazy(resolve => {
        const allPromises = this.models.map(async model => {
          const ops = transform(model.transform, event);

          const coll = conn.db.collection(model.collectionName);
          const modelOpsResult = await coll.bulkWrite(ops);

          await snapshotsCol.findOneAndUpdate(
            {
              name: model.name,
              version: model.version,
            },
            {
              $set: { __v: event.id },
            },
            {
              upsert: true,
            }
          );

          return {
            event: event.id,
            model: model.collectionName,
            added: modelOpsResult.nUpserted,
            modified: modelOpsResult.nModified,
            removed: modelOpsResult.nRemoved,
          };
        });

        return Promise.all(allPromises).then(resolve);
      });

    return kefirStreamOfBatchedEvents
      .flatten()
      .flatMapConcat(event => kefir.fromPromise(transformEvent(event)));
  }
};
