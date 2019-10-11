const bufferTimeCount = require("@async-generator/buffer-time-count");
const got = require("got");
const map = require("@async-generator/map");
const subject = require("@async-generator/subject");

const backoff = require("./backoff");
const commitEventToHeqServer = require("./commit");
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
  const reconnectBackoff = backoff({ seed: 10, max: 3000 });

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

  async function* begin(config = {}) {
    const {
      pulseCount = 200, // default maximum pulse size = 200 events
      pulseTime = 10, // default maximum wait time = 10ms
    } = config;

    const buffer = [];
    const MAX = ~~(1000 / pulseCount);
    const MIN = ~~(500 / pulseCount);

    const [batch$, emit] = subject(buffer);

    async function connect() {
      const [event$, abort] = await requestEvents({
        count: pulseCount,
        time: pulseTime,
      });
      console.log("connected!");
      const incoming$ = bufferTimeCount(event$, pulseCount, pulseTime);

      async function waitForOverflow() {
        if (buffer.length >= MAX) {
          console.log(
            "WARN: buffer overflow. %d over maximum %d",
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
          console.log("Pausing subscription because client is slow");
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
      for await (const batch of batch$) {
        const outputs = await Promise.all(
          stores.map(async store => {
            return store.handleEvents(batch);
          }),
        );

        yield outputs;
      }
    } finally {
      // abort();
    }
  }

  async function getLatestSuccessfulCheckPoint() {
    const latestEventIdArray = await Promise.all(
      stores.map(source => source.getLastSeenId()),
    );

    return Math.min(0, ...latestEventIdArray);
  }

  async function requestEvents() {
    const parseChunk = makeChunkParser();
    const [http$, emit] = subject();
    let forcedStop = false;

    const checkpoint = await getLatestSuccessfulCheckPoint();

    async function reconnect() {
      const delay = reconnectBackoff.next();

      console.log("reconnection scheduled after %dms", delay);

      await sleep(delay);
      request = await connectHeqServer();
    }

    async function connectHeqServer() {
      console.log("sending http request");
      const resp$ = got.stream(`${currentWriteTo}/subscribe`, {
        headers: {
          "last-event-id": String(checkpoint),
          includes: includes.join(","),
        },
      });

      const requestPromise = new Promise(resolve => {
        resp$.on("request", r => {
          resolve(r);
        });
      });

      resp$.on("error", error => {
        console.log("Error", error.message);
        // make sure we reconnect
        reconnect();
      });

      resp$.once("data", () => {
        console.log("start receiving data");
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

    let request = await connectHeqServer();
    const event$ = filter(
      map(flatten(http$), function(httpEvent) {
        if (httpEvent.event === "INCMSG") {
          return safeParseArrayFromJSON(httpEvent.data);
        }
      }),
      x => x,
    );

    function abort() {
      console.log("aborting");
      forcedStop = true;
      request && request.abort();
    }

    // return [spy(event$, "event"), abort];
    return [dedupe(event$, (a, b) => a.id === b.id), abort];
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
