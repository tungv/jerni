module.exports = class MongoDBStore {
  constructor(config) {
    console.error(
      `require("@jerni/store-mongo/Store") is deprecate and replaced by require("@jerni/store-mongo/makeStore")`,
    );
    process.exit(1);
  }
};
