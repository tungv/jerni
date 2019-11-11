const bufferTimeCount = require("@async-generator/buffer-time-count");
const got = require("got");
const map = require("@async-generator/map");
const subject = require("@async-generator/subject");
const JerniPersistenceTimeout = require("./JerniPersistenceTimeout");

const backoff = require("./backoff");
const commitEventToHeqServer = require("./commit");
const makeRacer = require("./racer");

module.exports = function createJourney({
  writeTo,
  stores,
  dev = process.env.NODE_ENV !== "production",
}) {
  let logger = console;
  const journey = {
    getReader,
    commit,
    begin,
    waitFor,
    monitor,
  };

  // add dev APIs
  if (dev) {
    journey.dev__replaceServer = function(newServer) {
      if (!newServer) {
        throw new Error(
          `Cannot replace heq-server address to ${JSON.stringify(newServer)}`,
        );
      }
      logger.info(
        "\nreplace heq-server address from %s to %s\n",
        currentWriteTo,
        newServer,
      );
      currentWriteTo = newServer;
    };
  }

  const last10 = [];
  let latestServer = null;
  let latestClient = null;
  let currentWriteTo = writeTo;
  const reconnectBackoff = backoff({ seed: 10, max: 3000 });

  // register models
  const STORE_BY_MODELS = new Map();
  stores.forEach((store, index) => {
    // register every models in each read source to STORE_BY_MODELS map
    // so we can retrieve them later in `#getReader(model)`
    store.registerModels(STORE_BY_MODELS);
  });

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

  getLatestSuccessfulCheckPoint().then(id => (latestClient = id));

  // handle watch
  let watcherCount = 0;
  let listeners = [];

  return journey;

  function startWatching() {
    watcherCount++;
    if (watcherCount > 1) return;

    listeners = stores.map((store, index) =>
      store.subscribe(id => racer.bump(index, id)),
    );
  }

  function stopWatching() {
    watcherCount--;
    if (watcherCount > 0) return;
    listeners.forEach(unsubscribe => unsubscribe());
  }

  async function getReader(model) {
    const source = STORE_BY_MODELS.get(model);

    if (source) {
      return source.getDriver(model);
    }

    throw new Error(`trying to read an unregistered model [${model.name}]`);
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

        const err = new JerniPersistenceTimeout(event);
        reject(err);
      }, maxWait);
    }).finally(() => {
      stopWatching();
    });
  }

  async function* begin(config = {}) {
    const {
      pulseCount = 200, // default maximum pulse size = 200 events
      pulseTime = 10, // default maximum wait time = 10ms
    } = config;

    if (config.logger) {
      logger.debug("\n=== SWITCH TO NEW LOGGER PROVIDED BY begin() ===\n");
      logger = config.logger;
    }

    logger.debug("journey.begin({ %o })", { pulseCount, pulseTime });

    const buffer = [];
    const MAX = ~~(10000 / pulseCount);
    const MIN = ~~(5000 / pulseCount);

    const [batch$, emit] = subject(buffer);

    async function connect() {
      const [event$, abort] = await requestEvents({
        count: pulseCount,
        time: pulseTime,
      });
      logger.info("connected!");
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
        yield await handleBatch(events);
      }
    } catch (ex) {
      logger.debug(ex);
      logger.error({ ex });
    } finally {
      logger.info("stop processing events");
    }
  }

  async function handleBatch(events) {
    logger.debug("handling events #%d - #%d", events[0].id, last(events).id);
    const start = process.hrtime.bigint();
    const outputs = await Promise.all(
      stores.map(async store => {
        return store.handleEvents(events);
      }),
    );
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

    return outputs;
  }

  async function getLatestSuccessfulCheckPoint() {
    const latestEventIdArray = await Promise.all(
      stores.map(source => source.getLastSeenId()),
    );

    return Math.min(latestEventIdArray);
  }

  async function requestEvents() {
    const parseChunk = makeChunkParser();
    const [http$, emit] = subject();
    let forcedStop = false;

    async function reconnect() {
      const delay = reconnectBackoff.next();

      logger.debug("reconnection scheduled after %dms", delay);

      await sleep(delay);
      request = await connectHeqServer({ delay });
    }

    async function connectHeqServer({ delay }) {
      const url = `${currentWriteTo}/subscribe`;
      const headers = {
        "last-event-id": String(await getLatestSuccessfulCheckPoint()),
        includes: includes.join(","),
      };
      logger.debug("sending http request to: %s", url);
      logger.debug("headers %o", headers);

      const resp$ = got.stream(url, { headers });

      const requestPromise = new Promise(resolve => {
        resp$.on("request", r => {
          resolve(r);
        });
      });

      resp$.once("error", error => {
        if (delay < 500) {
          logger.debug("sub 500ms reconnection… %o", {
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
      });

      resp$.on("data", chunk => {
        const maybeComplete = parseChunk(chunk);

        if (maybeComplete) emit(maybeComplete);
      });

      resp$.on("end", () => {
        // make sure we reconnect
        if (!forcedStop) {
          reconnect();
        }
      });

      return requestPromise;
    }

    let request = await connectHeqServer({ delay: 0 });
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

async function* spy(iter, label) {
  for await (const item of iter) {
    console.log("[%s]: %o", label, item);
    yield item;
  }
}

async function* filter(iter, predicate) {
  for await (const item of iter) {
    if (predicate(item)) yield* item;
  }
}

async function* sizeEffect(iter, fn) {
  for await (const item of iter) {
    fn(item);
    yield item;
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
