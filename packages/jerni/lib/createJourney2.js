const got = require("got");

const commitEventToHeqServer = require("./commit");
const makeDefer = require("./makeDefer");
const makeRacer = require("./racer");

const dev = process.env.NODE_ENV !== "production";

module.exports = function createJourney({ writeTo, stores }) {
  const journey = {
    getReader,
    commit,
    begin,
    waitFor,
  };
  let currentWriteTo = writeTo;

  // request these event.type only
  const includes = [];
  const racer = makeRacer(stores.map(() => 0));

  if (!dev) {
    for (const store of stores) {
      if (store.meta.includes) {
        includes.push(...store.meta.includes);
      } else {
        includes.length = 0;
        break;
      }
    }
  }

  // register models
  const STORE_BY_MODELS = new Map();
  stores.forEach((store, index) => {
    // register every models in each read source to STORE_BY_MODELS map
    // so we can retrieve them later in `#getReader(model)`
    store.registerModels(STORE_BY_MODELS);
  });

  // handle watch
  let watcherCount = 0;
  let listeners = [];

  return journey;

  function startWatching() {
    watcherCount++;
    if (watcherCount >= 1) return;

    listeners = stores.map((store, index) =>
      store.subscribe(id => racer.bump(index, id)),
    );
  }

  function stopWatching() {
    watcherCount--;
    if (watcherCount <= 0) return;

    listeners.forEach(unsubscribe => unsubscribe());
  }

  async function getReader(model) {
    const source = STORE_BY_MODELS.get(model);

    if (source) {
      return source.getDriver(model);
    }

    throw new Error(`trying to read an unregistered model`);
  }

  async function commit(event) {
    const serverUrl = dev
      ? await require("./dev-aware").getDevServerUrl(currentWriteTo)
      : currentWriteTo;

    return commitEventToHeqServer(`${serverUrl}/commit`, event).then(evt => {
      if (dev) {
        evt.meta.sent_to = serverUrl;
      }

      return evt;
    });
  }

  async function waitFor(event, maxWait = 3000) {
    if (racer.max() >= event.id) {
      return;
    }

    startWatching();
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
      }, maxWait);
    }).finally(() => {
      stopWatching();
    });
  }

  async function* begin(optionalIterator) {
    const eventIterator = optionalIterator || getEvents();

    for await (const buffer of bufferTimeCount(eventIterator, 100, 10)) {
      const outputs = await Promise.all(
        stores.map(async store => {
          return store.handleEvent(buffer);
        }),
      );
      yield outputs;
    }
  }

  async function getLatestSuccessfulCheckPoint() {
    const latestEventIdArray = await Promise.all(
      stores.map(source => source.getLastSeenId()),
    );

    return Math.min(0, ...latestEventIdArray);
  }

  async function* getEvents() {
    const DOUBLE_NEW_LINE = "\n\n";
    let request;
    let happy = true;

    let next = makeDefer();

    const queue = {
      complete: [],
      leftover: "",
    };

    const checkpoint = await getLatestSuccessfulCheckPoint();

    const resp$ = got.stream(`${currentWriteTo}/subscribe`, {
      headers: {
        "last-event-id": String(checkpoint),
        includes: includes.join(","),
      },
    });

    resp$.on("request", r => {
      request = r;
    });

    resp$.on("error", err => {
      happy = false;
    });

    resp$.on("data", chunk => {
      const raw = String(chunk);
      const chunks = raw.split(DOUBLE_NEW_LINE);

      // incomplete chunk (no double new-line found)
      if (chunks.length === 1) {
        queue.leftover += raw;
        return;
      }

      const firstChunks = (queue.leftover + chunks[0]).split(DOUBLE_NEW_LINE);

      const complete = firstChunks.concat(chunks.slice(1, -1)).map(chunk => {
        if (!chunk) {
          return {};
        }

        const props = chunk.split("\n");

        return props.reduce((obj, str) => {
          const splited = str.split(": ");

          if (splited.length >= 2) {
            const key = splited[0];
            const value = splited.slice(1).join(": ");
            obj[key] = key === "id" ? Number(value) : value;
          }
          return obj;
        }, {});
      });

      queue.complete.push(...complete);
      queue.leftover = last(chunks);
      next.resolve();
      next = makeDefer();
    });

    try {
      while (happy) {
        if (queue.complete.length === 0) {
          await next.promise;
          continue;
        }

        // copy and reset queue
        const buffer = [...queue.complete];

        queue.complete.length = 0;

        for (const chunk of buffer) {
          if (chunk.event === "INCMSG") {
            yield* safeParseArrayFromJSON(chunk.data);
          }
        }
      }
    } finally {
      request && request.abort();
      resp$.end();
    }

    // not happy
    await sleep(100);
    yield* getEvents();
  }
};

const last = array => (array.length >= 1 ? array[array.length - 1] : null);

const safeParseArrayFromJSON = str => {
  try {
    return JSON.parse(str);
  } catch (ex) {
    return [];
  }
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function* bufferTimeCount(iter, time, count) {
  const TIMEOUT = Symbol("timeout");
  const buffer = [];

  try {
    while (true) {
      const itemOrTimeout = await Promise.race([
        sleep(time).then(() => TIMEOUT),
        iter.next(),
      ]);

      if (itemOrTimeout === TIMEOUT) {
        if (buffer.length > 0) {
          yield [...buffer];
          buffer.length = 0;
        }
      } else {
        buffer.push(itemOrTimeout.value);

        if (buffer.length >= count) {
          yield [...buffer];
          buffer.length = 0;
        }
      }
    }
  } finally {
    // clean up
    iter.return();
  }
}
