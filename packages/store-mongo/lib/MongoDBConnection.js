const Connection = require('heq-store/lib/Connection');

const MongoClient = require('mongodb').MongoClient;
const makeDefer = require('./makeDefer');
const SNAPSHOT_COLLECTION_NAME = '__snapshots_v1.0.0';
const { watchWithoutReplicaSet } = require('./watch');

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
      return col.remove({});
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

  getDriver(model) {
    if (!this.connection) {
      throw new Error(`connection has not been made`);
    }

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
    return kefirStreamOfBatchedEvents.flatten().observe(async event => {
      // observe
      const allPromises = this.models.map(model => {
        return snapshotsCol.findOneAndUpdate(
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
      });

      const resp = await Promise.all(allPromises);
    });
  }
};
