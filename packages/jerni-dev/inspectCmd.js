const brighten = require("brighten");
const kleur = require("kleur");

const path = require("path");

const last = require("./utils/last");
const loadDatabase = require("./tasks/loadDatabase");
const loadQueue = require("./tasks/load-queue");
const createProxy = require("./lib/store-proxy");

module.exports = async filepath => {
  brighten();
  console.log(`${kleur.bgGreen.bold(" jerni-dev ")} inspect`);
  const queue = await loadQueue();
  const { id: latestInQueue } = await queue.getLatest();
  console.log(
    `Queue : ${kleur.italic("latest event ID")}`,
    kleur.green.bold(latestInQueue)
  );

  const { Pulses } = await loadDatabase();
  const latestInPulses = Pulses.count()
    ? last(Pulses.get(Pulses.max(`$loki`)).events)
    : 0;

  console.log(
    `Pulses: ${kleur.italic("latest event ID")} %s`,
    latestInPulses < latestInQueue
      ? kleur.bold.yellow(latestInPulses)
      : kleur.bold.green(latestInPulses)
  );

  const journey = await createProxy(path.resolve(process.cwd(), filepath));
  const versions = await journey.versions();
  versions.forEach(([source, v]) => {
    console.log(
      `Stores: %s: %s`,
      kleur.bold.italic(source),
      v < latestInQueue ? kleur.bold.yellow(v) : kleur.bold.green(v)
    );
  });
  journey.destroy();
  process.exit(0);
};
