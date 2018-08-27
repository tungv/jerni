const commitEventToHeqServer = require("./commit");
const makeRacer = require("./racer");
const getEventsStream = require("./subscribe");
const kefir = require("kefir");

module.exports = function initStore({ writeTo, readFrom }) {
  const SOURCE_BY_MODELS = new Map();
  const racer = makeRacer(readFrom.map(() => 0));

  let currentWriteTo = writeTo;

  readFrom.forEach((readSource, index) => {
    // register every models in each read source to SOURCE_BY_MODELS map
    // so we can retrieve them later in `#read(model)`
    readSource.registerModels(SOURCE_BY_MODELS);

    // we also subscribe for new changes from each source
    // in order to resolve `#waitFor(event)` and future `#waitFor(event, model)`
    readSource.subscribe(id => {
      racer.bump(index, id);
    });
  });

  const getReader = model => {
    const source = SOURCE_BY_MODELS.get(model);

    if (source) {
      return source.getDriver(model);
    }

    throw new Error(`trying to read an unregistered model`);
  };

  const commit = event => {
    return commitEventToHeqServer(`${currentWriteTo}/commit`, event);
  };

  const waitFor = event => {
    return racer.wait(event.id);
  };

  const getDefaultEventStream = async () => {
    const latestEventIdArray = await Promise.all(
      readFrom.map(source => source.getLastSeenId())
    );

    const oldestVersion = Math.min(...latestEventIdArray);

    const incomingEvents$ = await getEventsStream({
      queryURL: `${currentWriteTo}/query`,
      subscribeURL: `${currentWriteTo}/subscribe`,
      lastSeenId: oldestVersion
    });

    return incomingEvents$;
  };

  const subscribe = async nullableStream => {
    const incomingEvents$ = nullableStream || (await getDefaultEventStream());

    const output$PromiseArray = readFrom.map(source => {
      return source.receive(incomingEvents$).then(stream =>
        stream.map(output => ({
          source,
          output
        }))
      );
    });

    const output$Array = await Promise.all(output$PromiseArray);

    return kefir.merge(output$Array);
  };

  return {
    getReader,
    commit,
    waitFor,
    subscribe,

    DEV__replaceWriteTo: nextWriteTo => {
      currentWriteTo = nextWriteTo;
    },

    DEV__cleanAll: () => Promise.all(readFrom.map(src => src.clean())),

    DEV__getNewestVersion: async () => {
      const latestEventIdArray = await Promise.all(
        readFrom.map(source => source.getLastSeenId())
      );
      return Math.max(...latestEventIdArray);
    }
  };
};

const toArray = stream$ => stream$.scan((prev, next) => prev.concat(next), []);
