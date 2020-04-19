const createJourney = require("jerni");

module.exports = async function* migrate(fromAddress, toAddress, transform) {
  const heqCommitStore = await makeHeqCommitStore({
    heqServer: toAddress,
    transform,
  });

  const journey = createJourney({
    writeTo: fromAddress,
    stores: [heqCommitStore],
  });

  for await (const output of journey.begin({ pulseCount: 20 })) {
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

  const { heqServer, transform } = config;
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
        await commit(transformed);

        emit(id);
        last = id;
      }

      return last;
    },
    async getLastSeenId() {
      return getLatest(heqServer);
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
