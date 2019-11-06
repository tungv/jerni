const pkgDir = require("pkg-dir");

module.exports = async function(filepath) {
  const initializer = await requireAsync(filepath);

  const journey =
    typeof initializer === "function" ? await initializer() : initializer;

  if (!isJourneyInstance(journey)) {
    throw new Error(
      `initializer does not return a valid journey instance. Receive ${JSON.stringify(
        journey,
      )}`,
    );
  }

  const rootDir = pkgDir.sync(filepath);
  const toWatch = Object.keys(require.cache).filter(
    f => f.startsWith(rootDir) && !f.match("/node_modules/"),
  );

  return [journey, toWatch];
};

const requireAsync = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

function isJourneyInstance(inst) {
  if (inst == null) {
    return false;
  }
  if (typeof inst.getReader !== "function") {
    return false;
  }
  if (typeof inst.commit !== "function") {
    return false;
  }
  if (typeof inst.begin !== "function") {
    return false;
  }
  if (typeof inst.monitor !== "function") {
    return false;
  }
  if (typeof inst.waitFor !== "function") {
    return false;
  }

  return true;
}
