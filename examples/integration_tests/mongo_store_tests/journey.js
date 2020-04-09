const createJourney = require("jerni");
const mapEvents = require("jerni/lib/mapEvents");
const { Model, makeStore } = require("@jerni/store-mongo");

const modelA = new Model({
  name: "model_a",
  version: "1",
  transform: mapEvents({
    created: event => ({
      insertOne: {
        id: event.payload.id,
        name: event.payload.name,
      },
    }),
    renamed: event => ({
      updateOne: {
        where: { id: event.payload.id },
        changes: {
          $set: { name: event.payload.name },
        },
      },
    }),
  }),
});
const modelB = new Model({
  name: "model_B",
  version: "beta",
  transform: mapEvents({
    created: event => ({
      insertOne: {
        id: event.payload.id,
        names: [event.payload.name],
      },
    }),
    renamed: event => ({
      updateOne: {
        where: { id: event.payload.id },
        changes: {
          $push: { names: event.payload.name },
        },
      },
    }),
  }),
});

module.exports = async function initialize(writeTo, logger, onError) {
  const mongoStore = await makeStore({
    name: "test_mongo_basic",
    url: "mongodb://localhost:27017",
    dbName: "jerni_e2e_test_basic",
    models: [modelA, modelB],
  });

  return createJourney({
    writeTo,
    stores: [mongoStore],
    logger,
    onError,
  });
};

module.exports.ModelA = modelA;
module.exports.ModelB = modelB;
