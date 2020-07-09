const storeFactory = require("./store");
const model = require("./model");

module.exports = storeFactory({
  name: "neo",
  models: [model],
  url: "bolt://localhost:7687",
  user: "neo4j",
  password: "test",
});
