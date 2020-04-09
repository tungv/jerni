const bufferTimeCount = require("@async-generator/buffer-time-count");
const got = require("got");
const map = require("@async-generator/map");
const subject = require("@async-generator/subject");
const JerniPersistenceTimeout = require("./JerniPersistenceTimeout");
const version = require("../package.json").version;
const backoff = require("./backoff");
const commitEventToHeqServer = require("./commit");
const makeRacer = require("./racer");

function listening() {
  let $ = defer();

  let counter = 0;

  return {
    start() {
      counter++;
      if (counter === 1) {
        $.resolve();
      }
    },

    stop() {
      counter--;
      if (counter === 0) {
        $ = defer();
      }
    },

    async waitForFirstListen() {
      return $.promise;
    },
  };
}

function getLogger(dev) {
  if (!dev) return console;
  return require("./dev-aware").getLogger();
}

module.exports = function createJourney({
  writeTo,
  stores,
  dev = process.env.NODE_ENV !== "production",
  logger = getLogger(dev),
}) {
  const journey = {
    getReader,
    commit,
    begin,
    waitFor,
    monitor,

    // composite methods
    clean,
    dispose,

    // dev-mode
    handleEvents,
  };

  const last10 = [];
  let latestServer = null;
  let latestClient = null;
  let currentWriteTo = writeTo;
  const reconnectBackoff = backoff({ seed: 10, max: 3000 });

  const listener = listening();

  // register models
  const STORE_BY_MODELS = new Map();
  stores.forEach(async (store, index) => {
    // register every models in each read source to STORE_BY_MODELS map
    // so we can retrieve them later in `#getReader(model)`
    store.registerModels(STORE_BY_MODELS);

    await listener.waitForFirstListen();

    const lastSeenId = await store.getLastSeenId();
    racer.bump(index, lastSeenId);

    for await (const checkpoint of store.listen()) {
      racer.bump(index, checkpoint);
    }
  });

  // request these event.type only
  const includes = new Set();
  const racer = makeRacer(stores.map(() => 0));

  if (!dev) {
    for (const store of stores) {
      if (store.meta.includes) {
        store.meta.includes.forEach(type => {
          includes.add(type);
        });
      } else {
        includes.clear();
        break;
      }
    }
  }

  getLatestSuccessfulCheckPoint().then(id => (latestClient = id));

  return journey;

  async function getReader(model) {
    const source = STORE_BY_MODELS.get(model);

    if (source) {
      return source.getDriver(model);
    }

    throw new Error(`trying to read an unregistered model [${model.name}]`);
  }

  async function commit(event) {
    if (dev) {
      racer.reset();

      require("./dev-aware").connectDevServer({
        version,
        stores,
        writeTo,
      });
    }
    const serverUrl = dev
      ? await require("./dev-aware").getDevServerUrl(currentWriteTo)
      : currentWriteTo;

    const eventWithId = await commitEventToHeqServer(
      `${serverUrl}/commit`,
      event,
    );

    if (dev) {
      eventWithId.meta.sent_to = serverUrl;
      require("./dev-aware").logCommitted(serverUrl, eventWithId);
    }

    return eventWithId;
  }

  async function waitFor(event, maxWait = 3000) {
    if (racer.max() >= event.id) {
      return;
    }

    listener.start();

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

        const err = new JerniPersistenceTimeout(event);
        reject(err);
      }, maxWait);
    }).finally(() => {
      listener.stop();
    });
  }

  async function* begin(config = {}) {
    const {
      pulseCount = 200, // default maximum pulse size = 200 events
      pulseTime = 10, // default maximum wait time = 10ms
      serverUrl,
      cleanStart = false,
    } = config;

    if (config.logger) {
      logger = config.logger;
      logger.debug("=== SWITCH TO NEW LOGGER PROVIDED BY begin() ===");
    }

    logger.debug("journey.begin({%o})", {
      pulseCount,
      pulseTime,
      serverUrl,
      cleanStart,
    });

    if (serverUrl) {
      if (!dev) {
        throw new Error("Cannot change server address in production mode");
      }
      logger.debug(
        "replace heq-server address from %s to %s",
        currentWriteTo,
        serverUrl,
      );
      currentWriteTo = serverUrl;
    }

    if (cleanStart) {
      await clean();
    }

    const buffer = [];
    const MAX = ~~(10000 / pulseCount);
    const MIN = ~~(5000 / pulseCount);

    const [batch$, emit] = subject(buffer);

    async function connect() {
      const [event$, abort] = await requestEvents({
        count: pulseCount,
        time: pulseTime,
      });

      const incoming$ = bufferTimeCount(event$, pulseTime, pulseCount);

      async function waitForOverflow() {
        if (buffer.length >= MAX) {
          logger.warn(
            "buffer overflow. %d over maximum %d",
            buffer.length,
            MAX,
          );
          return;
        }

        await sleep(100);
        await waitForOverflow();
      }

      waitForOverflow()
        .then(() => {
          logger.debug("Pausing subscription because client is slow");
          return abort();
        })
        .then(scheduleResume);

      for await (const batch of incoming$) {
        if (batch.length > 0) emit(batch);
      }
    }

    async function scheduleResume() {
      await sleep(reconnectBackoff.next());
      if (buffer.length <= MIN) {
        connect();
      } else {
        scheduleResume();
      }
    }

    connect();

    try {
      for await (const events of batch$) {
        yield await handleEvents(events);
      }
    } catch (ex) {
      logger.debug(ex);
      logger.error({ ex });
    } finally {
      logger.info("stop processing events");
    }
  }

  async function handleEvents(events) {
    if (events.length === 1) {
      logger.debug("handling event #%d", events[0].id);
    } else {
      logger.debug("handling events #%d - #%d", events[0].id, last(events).id);
    }
    const start = process.hrtime.bigint();
    try {
      const outputs = await Promise.all(
        stores.map(async store => {
          return store.handleEvents(events);
        }),
      );
      return outputs;
    } catch (ex) {
      // error while handling events
      console.error(ex);
    } finally {
      const end = process.hrtime.bigint();
      const durationMs = Number((end - start).toString(10)) / 1e6;

      const report = {
        ts: Date.now(),
        from: events[0].id,
        to: last(events).id,
        count: events.length,
        durationMs,
      };

      last10.unshift(report);
      last10.length = Math.min(last10.length, 10);

      latestClient = last(events).id;
      logger.debug("done");
    }
  }

  async function getLatestSuccessfulCheckPoint() {
    const latestEventIdArray = await Promise.all(
      stores.map(source => source.getLastSeenId().catch(() => 0)),
    );

    return Math.min(...latestEventIdArray);
  }

  async function requestEvents() {
    const parseChunk = makeChunkParser();
    const [http$, emit] = subject();
    let forcedStop = false;
    let request = null;

    request = await connectHeqServer({ delay: 0 });

    async function reconnect() {
      if (request) {
        request.abort();
      }
      const delay = reconnectBackoff.next();

      logger.debug("reconnection scheduled after %dms", delay);

      await sleep(delay);
      request = await connectHeqServer({ delay });
    }

    async function connectHeqServer({ delay }) {
      const url = `${currentWriteTo}/subscribe`;
      const headers = {
        "last-event-id": String(await getLatestSuccessfulCheckPoint()),
        includes: [...includes].join(","),
      };
      logger.debug("sending http request to: %s", url);
      logger.debug("headers %o", headers);

      const resp$ = got.stream(url, { headers });

      const requestPromise = new Promise(resolve => {
        let currentRequest = null;
        resp$.on("request", r => {
          currentRequest = r;
          logger.debug("socket opened!");
        });

        resp$.once("error", error => {
          if (delay < 500) {
            logger.debug("sub 500ms reconnection… %j", {
              message: error.message,
              name: error.name,
            });
          } else {
            logger.error("repeating connection error", {
              message: error.message,
              name: error.name,
            });
          }

          // make sure we reconnect
          reconnect();
        });

        resp$.once("data", () => {
          logger.info("start receiving data");
          reconnectBackoff.reset();
          resolve(currentRequest);
        });

        resp$.on("data", chunk => {
          const maybeComplete = parseChunk(chunk);

          if (maybeComplete) emit(maybeComplete);
        });

        resp$.once("end", () => {
          // make sure we reconnect
          if (!forcedStop) {
            reconnect();
          }
        });
      });

      return requestPromise;
    }

    const event$ = filter(
      map(flatten(http$), function(httpEvent) {
        if (httpEvent.event === "INCMSG") {
          return safeParseArrayFromJSON(httpEvent.data);
        }
      }),
      x => x,
    );

    function abort() {
      logger.info("aborting");
      forcedStop = true;
      request && request.abort();
    }

    // return [spy(event$, "event"), abort];
    return [dedupe(event$, (a, b) => a.id === b.id), abort];
  }

  async function* monitor(config = {}) {
    const { interval = 5000 } = config;
    let lastReport = null;
    await updateLatestServer();
    yield {
      timestamp: Date.now(),
      performance: { last10 },
      latestServer,
      latestClient,
    };
    do {
      await sleep(interval);
      if (!last10[0]) {
        continue;
      }

      const report = last10[0];
      if (report === lastReport) {
        continue;
      }

      lastReport = report;

      await updateLatestServer();

      yield {
        timestamp: Date.now(),
        performance: { last10 },
        latestServer,
        latestClient,
      };
    } while (true);
  }

  async function updateLatestServer() {
    const url = `${currentWriteTo}/events/latest`;
    const { body } = await got(url, { json: true });
    latestServer = body.id;
  }

  async function clean() {
    if (!dev) {
      throw new Error("Cannot clean up stores in production mode");
    }
    logger.debug("cleaning %d store(s)", stores.length);
    for (const store of stores) {
      await store.clean();
    }
    logger.debug("cleaning complete");
  }

  async function dispose() {
    logger.debug("disposing %d store(s)", stores.length);
    for (const store of stores) {
      await store.dispose();
    }
    logger.debug("disposing complete");
  }
};

function makeChunkParser() {
  let leftover = "";
  const DOUBLE_NEW_LINE = "\n\n";
  return function parseChunk(chunk) {
    const raw = String(chunk);
    // console.log("on data");
    const chunks = raw.split(DOUBLE_NEW_LINE);

    // incomplete chunk (no double new-line found)
    if (chunks.length === 1) {
      leftover += raw;
      return;
    }

    const firstChunks = (leftover + chunks[0]).split(DOUBLE_NEW_LINE);

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

    leftover = last(chunks);
    if (complete.length) return complete;
  };
}

const last = array => (array.length >= 1 ? array[array.length - 1] : null);

const safeParseArrayFromJSON = str => {
  try {
    return JSON.parse(str);
  } catch (ex) {
    return [];
  }
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function* flatten(iter) {
  for await (const item of iter) {
    yield* item;
  }
}

async function* filter(iter, predicate) {
  for await (const item of iter) {
    if (predicate(item)) yield* item;
  }
}

const NO_ITEM = {};

async function* dedupe(iter, isEqual = (a, b) => a === b) {
  let lastItem = NO_ITEM;
  for await (const item of iter) {
    if (!isEqual(item, lastItem)) {
      yield item;
    }

    lastItem = item;
  }
}

function defer() {
  let resolve, reject;

  const promise = new Promise((_1, _2) => {
    resolve = _1;
    reject = _2;
  });
  return {
    promise,
    resolve,
    reject,
  };
}
