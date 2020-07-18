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

  async prime(convertModelToCollection) {
    const { index, collection, model, pipeline, opts } = this;

    let queryingCollection =
      model != null ? convertModelToCollection(model) : collection;

    const results = await queryingCollection
      .aggregate(pipeline, opts)
      .toArray();

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
