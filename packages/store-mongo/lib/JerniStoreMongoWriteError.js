module.exports = class JerniStoreMongoWriteError extends Error {
  constructor(bulkWriteError, model) {
    super(bulkWriteError.errmsg);
    this.name = "JerniStoreMongoWriteError";

    this.model = { name: model.name, version: model.version };
    this.code = bulkWriteError.code;
    this.err = bulkWriteError.err;
    this.op = bulkWriteError.op;
  }
};
