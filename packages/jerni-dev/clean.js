const rimraf = require("rimraf");
const createProxy = require("./lib/createProxy");
const path = require("path");

module.exports = async filepath => {
  const finalPath =
    filepath[0] === "+"
      ? require.resolve(filepath.slice(1))
      : path.resolve(process.cwd(), filepath);

  const store = await createProxy(finalPath);
  await store.DEV__cleanAll();
  rimraf.sync(path.resolve(process.cwd(), ".jerni-dev"));
  store.destroy();
};
