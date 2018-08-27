const Loki = require("lokijs");
const mitt = require("mitt");
const kefir = require("kefir");

const delokize = obj => {
  const { $loki, ...event } = { ...obj };
  event.meta = { ...obj.meta };

  event.id = $loki;

  delete event.meta.created;
  delete event.meta.revision;
  delete event.meta.version;

  if (Object.keys(event.meta).length === 0) {
    delete event.meta;
  }

  return event;
};

const defer = () => {
  let resolve, reject;
  const promise = new Promise((_res, _rej) => {
    resolve = _res;
    reject = _rej;
  });

  return { promise, resolve, reject };
};

const adapter = ({ ns = "local" }) => {
  const emitter = mitt();
  const { promise: events, resolve: done } = defer();
  let latest = null;

  const db = new Loki("heq-events.db", {
    autosave: true,
    autoload: true,
    autosaveInterval: 4000,
    autoloadCallback: () => {
      let coll = db.getCollection(ns);

      if (coll == null) {
        coll = db.addCollection(ns);
      } else {
        latest = coll.get(coll.max("$loki"));
      }

      done(coll);
    }
  });

  const commit = async event => {
    latest = (await events).insert({ ...event, meta: { ...event.meta } });
    db.saveDatabase();
    emitter.emit("data", latest);
    event.id = latest.$loki;

    return event;
  };

  const getLatest = async () => {
    await events;
    return latest ? delokize(latest) : { id: 0, type: "@@INIT" };
  };

  const query = async ({ from = -1, to }) => {
    if (from === -1) {
      return [];
    }

    if (to) {
      return (await events)
        .find({ $loki: { $between: [from + 1, to] } })
        .map(delokize);
    }

    return (await events).find({ $loki: { $gt: from } }).map(delokize);
  };

  const subscribe = () => ({
    events$: kefir.fromEvents(emitter, "data").map(delokize)
  });

  const destroy = () => {
    // noop
  };

  const getEvent = async id => delokize((await events).get(id));

  const api = { commit, subscribe, query, destroy, getLatest, getEvent };

  api.DEV__swap = async newEvents => {
    const Events = await events;
    Events.clear();
    newEvents.forEach(evt => Events.insert(evt));
    db.saveDatabase();
  };

  return api;
};

module.exports = adapter;
