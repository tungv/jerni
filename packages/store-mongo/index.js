const MongoClient = require('mongodb').MongoClient;

const getCollectionName = model => `${model.name}_${model.version}`;

class MongoDBReadModel {
  constructor({ name, version, transform }) {
    this.name = name;
    this.version = version;
    this.transform = transform;
    this.collection = null;
  }

  get connected() {
    return this.collection !== null;
  }

  async actuallyConnect() {
    const { connectionInfo } = this;
    const client = await MongoClient.connect(url);

    this.client = client;
    this.collection = client.db(dbName).getCollection(getCollectionName(this));
  }

  connect({ url, dbName }) {
    this.connectionInfo = { url, dbName };
    actuallyConnect();
    return this;
  }

  getReadOnlyInstance() {
    return this.collection;
  }

  subscribe(fn) {}
}

class Connected {}

module.exports = MongoDBReadModel;
