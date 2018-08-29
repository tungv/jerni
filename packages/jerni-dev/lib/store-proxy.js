const pkgDir = require("pkg-dir");

const importPathWithInterop = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

module.exports = async function createProxy(filepath) {
  let store = await importPathWithInterop(filepath);

  const rootDir = pkgDir.sync(filepath);
  const toWatch = Object.keys(require.cache).filter(f => f.startsWith(rootDir));

  return new Proxy(
    {},
    {
      get(_, prop) {
        return store[prop];
      }
    }
  );
};
