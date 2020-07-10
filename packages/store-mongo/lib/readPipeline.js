const AggregationSignal = require("./AggregationSignal");
const MongoDBReadModel = require("./MongoDBReadModel");

module.exports = function readPipeline(a1, a2) {
  let model, pipeline;

  if (a1 instanceof MongoDBReadModel) {
    model = a1;
    pipeline = a2;
  } else if (Array.isArray(a1)) {
    pipeline = a1;
    model = null;
  } else {
    throw new TypeError(
      "first argument of useAggregate must be either a pipeline or a MongoDBReadModel",
    );
  }

  const signal = new AggregationSignal(pipeline, {});
  if (model) {
    signal.model = model;
  }
  const results = signal.results();

  if (results) {
    return results;
  }
  throw signal;
};
