const createJourney = require("jerni");

module.exports = async function* migrate(fromAddress, toAddress, options = {}) {
  let { transform = identity, logger, pulseCount = 200, progress } = options;

  if (!progress.srcId) {
    logger.info("migrating from scratch");
    progress.srcId = 0;
  } else {
    logger.info("resuming from event#%d", progress.srcId);
  }

  const heqCommitStore = await makeHeqCommitStore({
    heqServer: toAddress,
    transform,
    progress,
  });

  const journey = createJourney({
    writeTo: fromAddress,
    stores: [heqCommitStore],
  });

  for await (const output of journey.begin({ pulseCount, logger })) {
    const total = await getLatest(fromAddress);
    yield [output[0], total];

    if (output[0] === total) {
      return;
    }
  }
};

const got = require("got");

async function getLatest(serverAddress) {
  const { body } = await got(`${serverAddress}/events/latest`, {
    responseType: "json",
  });
  return body.id;
}

async function makeHeqCommitStore(config) {
  const subject = require("@async-generator/subject");

  const { heqServer, transform, progress } = config;
  const [handled$, emit, end] = subject();

  async function commit(event) {
    if (!event.type) {
      throw new TypeError("Cannot commit an event without `type`");
    }
    const resp = await got.post(`${heqServer}/commit`, {
      json: event,
      responseType: "json",
    });

    return resp.body.id;
  }

  const store = {
    meta: {},
    name: `heq:${heqServer}`,
    registerModels(map) {
      // do nothing
    },
    getDriver() {
      // there is no driver
      return null;
    },
    async handleEvents(events) {
      let last = events[0].id;

      for (const { id, ...event } of events) {
        if (progress.srcId >= id) {
          continue;
        }
        let transformed = transform(event);

        if (transformed === false || typeof transformed === "undefined") {
          emit(id);
          continue;
        }

        if (transformed === true) {
          transformed = event;
        } else {
          transformed = Object.assign(event, transformed);
        }

        // now commit that transformed event
        const inserted = await commit(transformed);

        progress.srcId = id;
        progress.destId = inserted;

        emit(id);
        last = id;
      }

      return last;
    },
    async getLastSeenId() {
      return progress.srcId;
    },
    async *listen() {
      for await (const id of handled$) {
        yield id;
      }
    },
    clean() {
      throw new Error("cannot clean heq-server");
    },
    toString() {
      return store.name;
    },
    async dispose() {
      end();
    },
  };

  return store;
}

function identity(x) {
  return x;
}
