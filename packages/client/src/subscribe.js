import makeTransform, { getMeta } from '@events/transform';

import kefir from 'kefir';
import path from 'path';

import { setLogLevel, setReporter, shouldLog, write } from './logger';
import JSONReporter from './logger/json-reporter';
import ChalkReporter from './logger/chalk-reporter';
import connectSnapshot from './connectSnapshot';
import getEventsStream from './getEventsStream';
import loadModule from './utils/loadModule';
import makeSideEffects from './makeSideEffects';
import parseConfig from './utils/parseConfig';

const { params } = process.env;

const { json, verbose, configPath } = JSON.parse(params);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const noop = () => {};

setReporter(json ? JSONReporter : ChalkReporter);
setLogLevel(verbose);

write('INFO', {
  type: 'logger-ready',
  payload: {
    reporter: json ? 'json' : 'chalk',
    level: verbose,
  },
});

process.on('exit', code => {
  write('INFO', {
    type: 'process-exit',
    payload: {
      code,
    },
  });
});

process.on('SIGINT', () => {
  write('INFO', {
    type: 'process-interrupted',
  });
  process.exit(0);
});

prepare()
  .then(loop)
  .catch(handleErrors);

async function prepare() {
  write('INFO', {
    type: 'load-config-begin',
    payload: {
      path: configPath,
    },
  });

  const configDir = path.resolve(configPath, '..');
  let config;
  try {
    config = await parseConfig(require(configPath), configDir);
  } catch (e) {
    const shouldLogStack = shouldLog('DEBUG');
    const data = {
      type: 'load-config-failed',
      payload: {
        message: e.message,
      },
    };

    if (shouldLogStack) {
      data.payload.stack = e.stack;
    }
    write('FATAL', data);
    process.exit(1);
  }

  write('DEBUG', {
    type: 'load-config-end',
    payload: {
      config,
    },
  });

  // prepare transform
  const { transform: { rulePath } } = config;

  write('INFO', {
    type: 'load-transform-begin',
    payload: {
      rulePath,
    },
  });

  const rules = loadModule(rulePath);

  const transform = makeTransform(rules);
  const ruleMeta = getMeta(rules);

  write('DEBUG', {
    type: 'load-transform-end',
    payload: {
      ruleMeta,
    },
  });

  const state = {
    retryCount: 0,
  };

  const { sideEffects: { sideEffectsPath } } = config;

  // prepare sideEffects
  config.applySideEffect = sideEffectsPath
    ? makeSideEffects(loadModule(sideEffectsPath))
    : noop;

  return { config, ruleMeta, state, transform };
}

async function loop({ config, state, ruleMeta, transform }) {
  const persistenceConfig = config.persist;

  write('INFO', {
    type: 'connect-snapshot-begin',
    payload: {
      persistenceConfig,
    },
  });

  const { snapshotVersion, getPersistenceStream } = await connectSnapshot({
    persistenceConfig,
    ruleMeta,
  });

  write('INFO', {
    type: 'connect-snapshot-end',
    payload: {
      snapshotVersion,
    },
  });

  write('INFO', {
    type: 'connect-events-begin',
    payload: {
      serverUrl: config.subscribe.serverUrl,
      retryCount: state.retryCount,
    },
  });

  let latestEvent, ready, events$;

  try {
    const resp = await getEventsStream({
      subscriptionConfig: config.subscribe,
      from: snapshotVersion,
    });

    latestEvent = resp.latestEvent;
    ready = resp.ready;
    events$ = resp.events$;

    // reset count
    state.retryCount = 0;

    write('INFO', {
      type: 'connect-events-end',
      payload: {
        serverLatest: latestEvent.id,
      },
    });
  } catch (ex) {
    write('ERROR', ex);
    return attemptRetry({ config, state, ruleMeta, transform });
  }

  const distance = latestEvent.id - snapshotVersion;
  let caughtup = distance === 0;

  if (caughtup) {
    write('INFO', {
      type: 'subscription-catchup',
      payload: {
        time: 0,
      },
    });
  }

  const projection$ = events$.map(e => ({
    event: e,
    projections: transform(e),
  }));

  if (shouldLog('DEBUG')) {
    events$.observe(e => {
      write('DEBUG', {
        type: 'incoming-event',
        payload: {
          event: e,
        },
      });
    });
  }

  projection$.observe(ctx => {
    const { projections } = ctx;
    const changingCollections = Object.keys(projections).filter(
      key => projections[key].length
    );
    const hasChanges = changingCollections.length > 0;

    if (hasChanges) {
      write('INFO', {
        type: 'incoming-projection',
        payload: ctx,
      });
    } else {
      write('DEBUG', {
        type: 'incoming-projection-empty',
      });
    }
  });

  const persistence$ = getPersistenceStream(projection$);

  persistence$.observe(async out => {
    const { requests, changes } = out;
    const { event: firstEvent } = requests[0];
    const { event: lastEvent } = requests[requests.length - 1];
    const batch = [firstEvent.id, lastEvent.id];

    write('INFO', {
      type: 'persistence-complete',
      payload: { event: lastEvent, documents: changes, batch },
    });

    if (!caughtup && lastEvent.id >= latestEvent.id) {
      caughtup = true;
      const endTime = Date.now();
      const startTime = await ready;
      write('INFO', {
        type: 'subscription-catchup',
        payload: {
          time: endTime - startTime,
          count: latestEvent.id - snapshotVersion,
        },
      });
    }

    const { sideEffects: { sideEffectsPath } } = config;

    if (changes && sideEffectsPath) {
      const { successfulEffects, duration } = await config.applySideEffect(
        requests
      );

      write('INFO', {
        type: 'side-effects-complete',
        payload: { successfulEffects, duration },
      });
    }
  });

  const EMPTY = {};

  const endValue = await kefir
    .merge([persistence$, kefir.constant(EMPTY)])
    .toPromise();

  write('ERROR', {
    type: 'err-server-disconnected',
    payload: {
      isEmpty: endValue === EMPTY,
      reason: `connection to ${config.subscribe.serverUrl} interrupted`,
    },
  });

  return attemptRetry({ config, state, ruleMeta, transform });
}

const attemptRetry = async ({ config, state, ruleMeta, transform }) => {
  // retry
  const { retryFn, maxRetry } = config.subscribe;

  if (state.retryCount > maxRetry) {
    write('FATAL', {
      type: 'err-cannot-retry',
      payload: {
        max: maxRetry,
        count: state.retryCount,
      },
    });

    process.exit(1);
  }

  const nextRetry = retryFn(state.retryCount);

  state.retryCount++;
  state.nextRetryAt = Date.now() + nextRetry;

  write('INFO', {
    type: 'await-retry',
    payload: {
      retryAfter: nextRetry,
      retryAt: state.nextRetryAt,
    },
  });

  await sleep(nextRetry);
  return loop({ config, state, ruleMeta, transform });
};

async function handleErrors(ex) {
  console.error(ex);
  console.error(ex.stack);
  process.exit(1);
}
