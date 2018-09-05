const createJourney = require("jerni");
const { Store } = require("@jerni/store-mongo");
const people = require("./models/people");

const mongoStore = new Store({
  name: "mongodb",
  url: "mongodb://localhost:27017",
  dbName: "examples",
  models: [people]
});

const journey = createJourney({
  writeTo: "https://events.jerni.app",
  stores: [mongoStore]
});

module.exports = journey;
