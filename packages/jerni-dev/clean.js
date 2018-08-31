const rimraf = require("rimraf");
const createProxy = require("./lib/store-proxy");
const path = require("path");

module.exports = async filepath => {
  const store = await createProxy(path.resolve(process.cwd(), filepath));
  await store.DEV__cleanAll();
  rimraf.sync(path.resolve(process.cwd(), ".jerni-dev"));
  store.destroy();
};
