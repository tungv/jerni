const path = require("path");

const { wrap } = require("./background");
const requireJourneyAndDeps = require("./requireJourneyAndDeps");

module.exports = wrap(async function start({ absolutePath, heqServerAddress }) {
  const [journey, deps] = await requireJourneyAndDeps(absolutePath);

  journey.dev__replaceServer(heqServerAddress);

  (async function() {
    for await (const output of journey.begin({ pulseTime: 100 })) {
      console.log(output);
    }
  })();

  return deps;
});
