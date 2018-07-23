const path = require('path');
const pkgUp = require('pkg-up');
const InvalidConfigError = require('./InvalidConfigError');
const InvalidEndpoint = require('./InvalidEndpoint');
const detectDriver = require('./detectPersistDriver');
const DriverNotFoundError = require('./DriverNotFoundError');
const hasModule = require('./has-module');

module.exports = async (config, configRoot) => {
  const {
    subscribe,
    persist,
    transform,
    monitor = {},
    sideEffects = {},
    sideEffect = {},
    hotReload = {},
    useBabel = false,
  } = config;

  if (useBabel) {
    require(typeof useBabel === 'string' ? useBabel : 'babel-register');
  }

  if (!subscribe) {
    throw new InvalidConfigError({
      path: 'subscribe',
      expected: 'Object',
      actual: JSON.stringify(subscribe),
    });
  }

  const {
    serverUrl,
    burstCount = 20,
    burstTime = 500,
    retryFn = count => 10 + 10 * (2 << (count - 1)),
    maxRetry = 20,
  } = subscribe;

  if (!serverUrl) {
    throw new InvalidConfigError({
      path: 'subscribe.serverUrl',
      expected: 'http or https endpoint',
      actual: JSON.stringify(serverUrl),
    });
  }

  await validateServerUrl(serverUrl);

  const { store, driver, seedFilePath } = persist;
  const absSeedFilePath = seedFilePath
    ? path.join(configRoot, seedFilePath)
    : false;

  if (absSeedFilePath) {
    try {
      require(absSeedFilePath);
    } catch (ex) {
      throw new InvalidConfigError({
        path: 'persist.seedFilePath',
        expected: 'a JSON file path',
        actual: ex.message,
      });
    }
  }

  if (!store) {
    throw new InvalidConfigError({
      path: 'persist.store',
      expected: 'a connection string',
      actual: JSON.stringify(store),
    });
  }

  const actualDriver = driver || detectDriver(store);

  if (!hasModule(actualDriver)) {
    throw new DriverNotFoundError(actualDriver);
  }

  const { rulePath, rulesPath } = transform;

  const absRulePath = path.resolve(configRoot, rulePath || rulesPath);

  const { sideEffectsPath, sideEffectPath } = sideEffects || sideEffect;

  const applyingSideEffect =
    sideEffectsPath &&
    hasModule(path.resolve(configRoot, sideEffectsPath || sideEffectPath));

  const finalSideEffects = applyingSideEffect
    ? { sideEffectsPath: path.resolve(configRoot, sideEffectsPath) }
    : { sideEffectsPath: false };

  const { port } = monitor;

  const watchPaths = await parseHotReload(hotReload, configRoot);

  return {
    subscribe: {
      serverUrl,
      burstCount,
      burstTime,
      retryFn,
      maxRetry,
    },
    persist: {
      store,
      driver: actualDriver,
      seedFilePath: absSeedFilePath,
    },
    transform: {
      rulePath: absRulePath,
    },
    sideEffects: finalSideEffects,
    hotReload: {
      watchPaths,
    },
    monitor: {
      port,
    },
  };
};

async function validateServerUrl(url) {
  const request = require('request-promise');

  try {
    const resp = await request(`${url}/query`, { json: true });

    if (Array.isArray(resp) && resp.length === 0) {
      return true;
    }
  } catch (e) {
    const { message } = e;
    throw new InvalidEndpoint({
      endpoint: url,
      reason: message,
    });
  }

  throw new InvalidEndpoint({
    endpoint: url,
    reason: 'not an event server',
  });
}

const parseHotReload = async (hotReload, configRoot) => {
  const { enabled, enable } = hotReload;

  if (enabled || enable) {
    let { watchPaths: toWatch } = hotReload;

    if (Array.isArray(toWatch)) {
      return toWatch;
    }

    if (!toWatch) {
      // Find out which directory to watch
      const closestPkg = await pkgUp(configRoot);
      return [closestPkg ? path.dirname(closestPkg) : process.cwd()];
    }

    return [toWatch];
  }

  return false;
};
