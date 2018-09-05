const cwd = process.cwd();
const path = require("path");

const requireAsync = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

module.exports = async filepath => {
  const journey = await requireAsync(path.resolve(cwd, filepath));

  const outgoing$ = await journey.subscribe();

  const sub = outgoing$.observe(
    ({ source, output }) => {
      console.log("sub data");
    },
    err => {
      console.error("sub err", err);
    },
    () => {
      console.log("sub end");
    }
  );
};
