const kefir = require("kefir");

const commitEventToHeqServer = require("./commit");
const getEventsStream = require("./subscribe");
const makeRacer = require("./racer");

const dev = process.env.NODE_ENV !== "production";

module.exports = function createJourney({ writeTo, stores }) {
  const SOURCE_BY_MODELS = new Map();
  const racer = makeRacer(stores.map(() => 0));

  let currentWriteTo = writeTo;

  stores.forEach((store, index) => {
    // register every models in each read source to SOURCE_BY_MODELS map
    // so we can retrieve them later in `#read(model)`
    store.registerModels(SOURCE_BY_MODELS);
  });

  const enableWatchMode = once(() => {
    stores.forEach((store, index) => {
      // we also subscribe for new changes from each source
      // in order to resolve `#waitFor(event)` and future `#waitFor(event, model)`
      store.subscribe(id => {
        racer.bump(index, id);
      });
    });
  });

  const getReader = model => {
    const source = SOURCE_BY_MODELS.get(model);

    if (source) {
      return source.getDriver(model);
    }

    throw new Error(`trying to read an unregistered model`);
  };

  const commit = async event => {
    const serverUrl = dev
      ? await require("./dev-aware").getDevServerUrl(currentWriteTo)
      : currentWriteTo;

    return commitEventToHeqServer(`${serverUrl}/commit`, event).then(evt => {
      if (dev) {
        evt.meta.sent_to = serverUrl;
      }

      return evt;
    });
  };

  function waitFor(event, ms = 3000) {
    if (racer.max() >= event.id) {
      return;
    }
    enableWatchMode();
    return new Promise((resolve, reject) => {
      let resolved = false;
      let timeoutId;

      racer.wait(event.id).then(() => {
        resolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve();
      });

      timeoutId = setTimeout(() => {
        if (resolved) return;

        if (dev) {
          require("./dev-aware").waitTooLongExplain({ event, stores });
        }

        const err = new Error();
        err.name = "JerniPersistenceTimeout";
        err.message = `Timeout: wait too long for #${event.id} - ${event.type}`;
        err.data = {
          id: event.id,
          type: event.type,
        };
        reject(err);
      }, ms);
    });
  }

  const getDefaultEventStream = async () => {
    const includes = [];

    for (const store of stores) {
      if (store.meta.includes) {
        includes.push(...store.meta.includes);
      } else {
        includes.length = 0;
        break;
      }
    }

    const incomingEvents$ = await getEventsStream({
      includes,
      subscribeURL: `${currentWriteTo}/subscribe`,
      lastSeenIdGetter: async () => {
        const latestEventIdArray = await Promise.all(
          stores.map(source => source.getLastSeenId()),
        );

        return Math.min(...latestEventIdArray);
      },
    });

    return incomingEvents$;
  };

  const subscribe = async nullableStream => {
    const incomingEvents$ = nullableStream || (await getDefaultEventStream());

    const output$PromiseArray = stores.map(source => {
      return source.receive(incomingEvents$).then(stream =>
        stream.map(output => ({
          source,
          output,
        })),
      );
    });

    const output$Array = await Promise.all(output$PromiseArray);

    return kefir.merge(output$Array);
  };

  const journey = {
    getReader,
    commit,
    waitFor,
    subscribe,
    dispose: () => {
      stores.forEach(store => store.dispose());
    },

    versions: async () => {
      const latestEventIdArray = await Promise.all(
        stores.map(source => source.getLastSeenId()),
      );

      const vx = stores.reduce(
        (array, store, index) =>
          array.concat([[store.name, latestEventIdArray[index]]]),
        [],
      );
      return vx;
    },
  };

  if (dev) {
    Object.assign(journey, {
      DEV__replaceWriteTo: nextWriteTo => {
        currentWriteTo = nextWriteTo;
      },

      DEV__cleanAll: () => Promise.all(stores.map(src => src.clean())),

      DEV__getNewestVersion: async () => {
        const latestEventIdArray = await Promise.all(
          stores.map(source => source.getLastSeenId()),
        );
        return Math.max(...latestEventIdArray);
      },
    });
  }

  return journey;
};

const once = fn => {
  let tries = 0;
  return (...args) => {
    if (!tries++) {
      return fn(...args);
    }
  };
};
