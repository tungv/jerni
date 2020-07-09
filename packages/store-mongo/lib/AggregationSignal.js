class AggregationSignal {
  constructor(pipeline, opts) {
    this.index = counter++;
    this.pipeline = pipeline;
    this.opts = opts;
    this.collection = activeCollection;
  }

  results() {
    const { index, collection } = this;
    const cacheKey = [collection.collectionName, index].join("##");

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    return;
  }

  fill(event, collection) {
    this.event = event;
    this.collection = collection;
  }

  async prime(convertModelToCollection) {
    let { index, collection, model, pipeline, opts } = this;

    if (model != null) {
      collection = convertModelToCollection(model);
    }

    const results = await collection.aggregate(pipeline, opts).toArray();
    const cacheKey = [collection.collectionName, index].join("##");

    cache.set(cacheKey, results);
  }
}

let counter = 0;
let cache = new Map();

let activeCollection = null;

function collect(collection, cb) {
  activeCollection = collection;

  try {
    return cb();
  } finally {
    reset();
  }
}

function reset() {
  counter = 0;
  activeCollection = null;
}

AggregationSignal.collect = collect;
AggregationSignal.cache = cache;

module.exports = AggregationSignal;
