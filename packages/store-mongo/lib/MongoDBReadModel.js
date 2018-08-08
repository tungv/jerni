module.exports = class MongoDBReadModel {
  constructor({ name, version, transform }) {
    this.name = name;
    this.version = version;
    this.transform = transform;
  }

  toString() {
    return `[MongoDBReadModel ${this.name}_v${this.version}]`;
  }

  get collectionName() {
    return `${this.name}_v${this.version}`;
  }
};
