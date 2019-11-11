const { wrap } = require("./background");
const requireJourneyAndDeps = require("./requireJourneyAndDeps");
const getLogger = require("./dev-logger");

module.exports = wrap(async function start({
  absolutePath,
  cleanStart,
  heqServerAddress,
  verbose,
}) {
  const [journey, deps] = await requireJourneyAndDeps(absolutePath);

  const logger = getLogger({ service: "jerni", verbose });

  (async function() {
    for await (const output of journey.begin({
      logger,
      serverUrl: heqServerAddress,
      cleanStart,
    })) {
      logger.info(output);
    }
  })();

  return deps;
});
