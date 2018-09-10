const brighten = require("brighten");
const colors = require("ansi-colors");

const path = require("path");

const { DEV_DIR } = require("./tasks/constants");
const createProxy = require("./lib/createProxy");
const last = require("./utils/last");
const loadDatabase = require("./tasks/loadDatabase");
const loadQueue = require("./tasks/load-queue");

module.exports = async filepath => {
  brighten();
  console.log(`${colors.bgGreen.bold(" jerni-dev ")} inspect`);
  console.log("cwd:".padEnd(8), process.cwd());
  console.log(
    "DEV_DIR:".padEnd(8),
    colors.italic.bold.blue(path.relative(process.cwd(), DEV_DIR))
  );
  const queue = await loadQueue();
  const { id: latestInQueue } = await queue.getLatest();
  console.log(
    `Queue:   ${colors.italic("latest event ID")}`,
    colors.green.bold(latestInQueue)
  );

  const { Pulses } = await loadDatabase();
  const latestInPulses = Pulses.count()
    ? last(Pulses.get(Pulses.max(`$loki`)).events)
    : 0;

  console.log(
    `Pulses:  ${colors.italic("latest event ID")} %s`,
    latestInPulses < latestInQueue
      ? colors.bold.yellow(latestInPulses)
      : colors.bold.green(latestInPulses)
  );

  const finalPath =
    filepath[0] === "+"
      ? require.resolve(filepath.slice(1))
      : path.resolve(process.cwd(), filepath);

  const journey = await createProxy(finalPath);
  const versions = await journey.versions();
  versions.forEach(([source, v]) => {
    console.log(
      `Stores:  %s: %s`,
      colors.bold.italic(source),
      v < latestInQueue ? colors.bold.yellow(v) : colors.bold.green(v)
    );
  });
  journey.destroy();
  process.exit(0);
};
