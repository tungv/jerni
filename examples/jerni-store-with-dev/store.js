// store.js
const initStore = require("jerni-store");
const { Connection } = require("@heq/store-mongo");
const people = require("./models/people");

const mongoSource = new Connection({
  name: "mongodb",
  url: "mongodb://localhost:27017",
  dbName: "examples",
  models: [people]
});

const store = initStore({
  writeTo: "https://events.tung.ninja",
  stores: [mongoSource]
});

module.exports = store;
