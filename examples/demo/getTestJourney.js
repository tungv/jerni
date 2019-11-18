const getJerniDevInstance = require("jerni-dev/test");

module.exports = async function getTestJourney(url, dbName, initial = []) {
  process.env.MONGODB_URL = url;
  process.env.MONGODB_DBNAME = dbName;
  const journey = await require("./my-journey")();

  const testJourney = await getJerniDevInstance(journey, initial);

  return testJourney;
};
