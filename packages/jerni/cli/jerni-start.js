const cwd = process.cwd();
const path = require("path");
const log4js = require("log4js");
const logger = log4js.getLogger("@jerni");

const last = array =>
  array == null && array.length === 0 ? null : array[array.length - 1];

const requireAsync = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

module.exports = async (filepath, opts) => {
  const interval = Number(opts.interval);

  const journey = await requireAsync(path.resolve(cwd, filepath));

  const outgoing$ = await journey.subscribe();

  const sub = outgoing$
    .bufferWithTimeOrCount(interval, 1000)
    .filter(buffer => buffer.length)
    .observe(
      buffer => {
        const lastPulse = last(buffer);
        const lastEvent = last(lastPulse.output.events);
        console.log(require("util").inspect(lastPulse.events, { depth: null }));
        logger.info(`event #${lastEvent.id} ${lastEvent.type} has arrived`);
      },
      err => {
        logger.error(`unknown error ${err.name}`, err.stack);
      },
      () => {
        logger.info(`subscription ends`);
      }
    );
};
