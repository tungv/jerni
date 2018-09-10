const rimraf = require("rimraf");
const colors = require("ansi-colors");
const path = require("path");

const { DEV_DIR } = require("./tasks/constants");
const createProxy = require("./lib/createProxy");

module.exports = async filepath => {
  const finalPath =
    filepath[0] === "+"
      ? require.resolve(filepath.slice(1))
      : path.resolve(process.cwd(), filepath);

  console.log(`${colors.bgGreen.bold(" jerni-dev ")} clean`);
  console.log("cwd:".padEnd(8), process.cwd());
  console.log(
    "DEV_DIR:".padEnd(8),
    colors.italic.bold.blue(path.relative(process.cwd(), DEV_DIR))
  );

  const store = await createProxy(finalPath);
  await store.DEV__cleanAll();
  rimraf.sync(DEV_DIR);
  store.destroy();
};
