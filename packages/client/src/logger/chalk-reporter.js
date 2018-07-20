import chalk from 'chalk';
import format from 'date-fns/format';
import prettyMs from 'pretty-ms';

import { inspect } from 'util';

let lastLogTime = 0;
let lastFullTime = 0;

export default (level, data) => {
  const prefix = PREFIXES[level] || PREFIXES.SILLY;
  const handler = handlers[data.type] || unknownTypeLogger;
  const now = Date.now();
  const relativeClose = now - lastLogTime <= 1000;
  const shouldLogDelta = relativeClose && now - lastFullTime <= 5000;
  const timeStr = shouldLogDelta
    ? ` +${prettyMs(now - lastLogTime)}`.padStart(29, '-')
    : format(now);

  if (!shouldLogDelta) lastFullTime = now;

  lastLogTime = now;

  console.log(`${prefix} ${chalk.italic.dim(timeStr)}:`, handler(data.payload));
};

const PREFIXES = {
  SILLY: chalk.bgWhite.black.bold.dim(' SLY '),
  DEBUG: chalk.bgWhite.black.bold(' DBG '),
  INFO: chalk.bgGreen.bold(' INF '),
  WARN: chalk.bgYellow.black.bold(' WAR '),
  ERROR: chalk.bgRed.bold(' ERR '),
  FATAL: chalk.bgMagenta.bold(' FTL '),
};

const unknownTypeLogger = payload => JSON.stringify(payload);
const formatFilePath = path => chalk.bold.green(path);
const formatJSON = json => inspect(json, { depth: 2, colors: true });

const handlers = {
  'logger-ready': payload => `Log: ${payload.level}`,
  inspect: payload => JSON.stringify(payload),
  'err-server-disconnected': payload =>
    `Connection to Events Server has lost. Reason: ${payload.reason}`,
  'err-side-effect-failed': payload => {
    const msg = `Side Effects did not complete. Error thrown: ${
      payload.error.message
    }`;
    if (payload.error.stack) {
      msg += `
Stacktrace:
${payload.error.stack}
`;
    }
    return msg;
  },
  'process-exit': payload => `Process exitting with code ${payload.code}`,
  'process-interrupted': () => `Process interrupted`,
  'load-config-begin': payload =>
    `Loading config from ${formatFilePath(payload.path)}`,
  'load-config-end': payload => `Config loaded:\n${formatJSON(payload)}`,
  'load-config-failed': payload =>
    `Config has failed to load with the following message: ${payload.message}`,
  'load-transform-begin': payload =>
    `Compiling transformation rules from file: ${formatFilePath(
      payload.rulePath
    )}`,
  'load-transform-end': payload => `transformation rules compilation complete.
Interested collections:
  ${payload.ruleMeta
    .map(
      ({ name, version }) =>
        `${chalk.bold(name)} - ${chalk.bold.dim('v' + version)}`
    )
    .join('\n  ')}`,
  'connect-snapshot-begin': payload =>
    `Attempting to connect to persistence storage [${formatFilePath(
      payload.persistenceConfig.store
    )}] - driver: ${chalk.bold.cyan(payload.persistenceConfig.driver)}.`,
  'connect-snapshot-end': payload =>
    `Connected to persistence storage. Local version: ${chalk.bold.cyan(
      payload.snapshotVersion
    )}`,
  'connect-events-begin': payload =>
    `Attempting to connect to events server [${formatFilePath(
      payload.serverUrl
    )}]. ${payload.retryCount ? `Retry: #${payload.retryCount}` : 'First try'}`,
  'connect-events-end': payload =>
    `Connected to events server. Latest server version: ${chalk.bold.cyan(
      payload.serverLatest
    )}`,
  'subscription-catchup': payload =>
    payload.time
      ? `caught up with server after ${prettyMs(payload.time)} (${(
          payload.count *
          1000 /
          payload.time
        ).toFixed(2)} events/s)`
      : 'caught up immediately',
  'incoming-event': payload =>
    `Incoming event: ${chalk.bold(payload.event.type)} ${chalk.dim(
      `#${payload.event.id}`
    )}`,
  'incoming-projection-empty': () => chalk.dim('nothing happens'),
  'incoming-projection': payload => {
    const { projections } = payload;
    const { __v } = projections;

    const changes = Object.keys(projections)
      .filter(k => k !== '__v')
      .map(aggregateName =>
        projections[aggregateName].map(change => {
          const prefix = chalk.bold.italic(`${aggregateName}_v${change.__pv}`);

          if (change.op.update) {
            return `${prefix}: updating where ${JSON.stringify(
              change.op.update.where
            )}`;
          }
          if (change.op.insert) {
            return `${prefix}: inserting ${
              change.op.insert.length
            } document(s)`;
          }
        })
      )
      .reduce((a, b) => a.concat(b));

    if (changes.length) {
      return `${changes.length} update(s) after event #${__v}\n- ${changes.join(
        '\n- '
      )}`;
    } else {
      return chalk.dim('nothing happens');
    }
  },
  'persistence-complete': payload => {
    const { event, documents, batch } = payload;

    const batchString =
      batch[0] === batch[1]
        ? `event: #${batch[0]}`
        : `events: #${batch[0]} - #${batch[1]}`;

    return `Persistence complete (${batchString}). ${documents} document(s) affected. Latest local version is ${
      event.id
    }`;
  },
  'side-effects-complete': payload =>
    `Side Effects complete: ${
      payload.successfulEffects
    } effect(s) completed after ${prettyMs(payload.duration)}`,
  'err-cannot-retry': payload =>
    `Retry has failed ${payload.count} times. Max retry = ${payload.max}.`,
  'await-retry': payload =>
    `Will retry at ${format(payload.retryAt)} (after ${prettyMs(
      payload.retryAfter
    )})`,
};
