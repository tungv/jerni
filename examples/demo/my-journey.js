const createJourney = require("jerni");
const makeStore = require("@jerni/store-mongo/makeStore");
const users = require("./models/users");

module.exports = async function initialize() {
  const mongoStore = await makeStore({
    name: "my_test_mongo_store",
    url: process.env.MONGODB_URL,
    dbName: process.env.MONGODB_DBNAME,
    models: [users],
  });

  const myJourney = createJourney({
    writeTo: "http://localhost:9090",
    stores: [mongoStore],
  });

  return myJourney;
};
