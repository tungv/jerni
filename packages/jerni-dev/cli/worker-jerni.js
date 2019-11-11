const { wrap } = require("./background");
const requireJourneyAndDeps = require("./requireJourneyAndDeps");
const getLogger = require("./dev-logger");

module.exports = wrap(async function start({
  absolutePath,
  cleanStart,
  heqServerAddress,
}) {
  const [journey, deps] = await requireJourneyAndDeps(absolutePath);

  journey.dev__replaceServer(heqServerAddress);

  if (cleanStart) {
    console.log("cleaning");
    await journey.dev__clean();
  }

  const logger = getLogger({ service: "jerni", verbose: false });

  (async function() {
    for await (const output of journey.begin({ pulseTime: 10, logger })) {
      console.log(output);
    }
  })();

  return deps;
});
