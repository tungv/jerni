const createJourney = require("jerni-store");
const { Store } = require("@jerni/store-mongo");
const people = require("./models/people");

const mongoSource = new Store({
  name: "mongodb",
  url: "mongodb://localhost:27017",
  dbName: "examples",
  models: [people]
});

const journey = createJourney({
  writeTo: "https://events.tung.ninja",
  stores: [mongoSource]
});

module.exports = journey;
