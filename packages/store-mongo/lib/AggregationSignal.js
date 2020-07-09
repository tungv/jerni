module.exports = class AggregationSignal {
  static counter = 0;
  static cache = new Map();

  static activeCollection = null;

  static collect(collection, cb) {
    this.activeCollection = collection;

    try {
      return cb();
    } finally {
      this.reset();
    }
  }

  static reset() {
    this.counter = 0;
    this.activeCollection = null;
  }

  constructor(pipeline, opts) {
    this.index = AggregationSignal.counter++;
    this.pipeline = pipeline;
    this.opts = opts;
    this.collection = AggregationSignal.activeCollection;
  }

  results() {
    const { index, collection } = this;
    const cacheKey = [collection.collectionName, index].join("##");

    console.log(
      require("util").inspect(AggregationSignal.cache, {
        depth: null,
        colors: true,
      }),
    );

    if (AggregationSignal.cache.has(cacheKey)) {
      return AggregationSignal.cache.get(cacheKey);
    }

    return;
  }

  fill(event, collection) {
    this.event = event;
    this.collection = collection;
  }

  async prime() {
    const { index, collection, pipeline, opts } = this;
    const results = await collection.aggregate(pipeline, opts).toArray();
    const cacheKey = [collection.collectionName, index].join("##");

    AggregationSignal.cache.set(cacheKey, results);
  }
};
