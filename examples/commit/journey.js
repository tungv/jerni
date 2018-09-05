const { Store } = require("@jerni/store-mongo");
const createJourney = require("jerni");

const accounts = require("./models/accounts");

const writeTo =
  process.env.NODE_ENV === "production" ? "https://events.jerni.app" : null;

module.exports = createJourney({
  writeTo,
  stores: [
    new Store({
      name: "bank",
      url: "mongodb://localhost:27017",
      dbName: "example_bank",
      models: [accounts]
    })
  ]
});
