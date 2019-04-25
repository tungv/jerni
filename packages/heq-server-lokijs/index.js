const Loki = require("lokijs");
const mitt = require("mitt");
const kefir = require("kefir");

const alwaysTrue = () => true;

const delokize = obj => {
  if (obj == null) {
    return obj;
  }

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

const adapter = ({ ns = "local", filepath = "heq-events.db" }) => {
  const emitter = mitt();
  const { promise: events, resolve: done } = defer();
  let latest = null;

  const db = new Loki(filepath, {
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
    },
  });

  async function* generate(lastEventId, count, time, includingTypes) {
    const filter = includingTypes.length
      ? event => includingTypes.includes(event.type)
      : alwaysTrue;

    const Events = await events;

    let from = lastEventId;

    const unread = Events.find({ $loki: { $gt: from } })
      .filter(filter)
      .map(delokize);
    const buffer = [];

    for (const event of unread) {
      buffer.push(event);

      if (buffer.length >= count) {
        yield [...buffer];
        buffer.length = 0;
      }
    }

    if (buffer.length) {
      yield buffer.length;
    }

    let subscription;

    try {
      subscription = kefir
        .fromEvents(emitter, "data")
        .filter(filter)
        .map(delokize)
        .bufferWithTimeOrCount(time, count)
        .filter(array => array.length)
        .observe(events => {
          buffer.push(...events);
        });

      while (true) {
        if (buffer.length) {
          yield [...buffer];
          buffer.length = 0;
        }
      }
    } finally {
      if (subscription) {
        subscription.unsubscribe();
      }
    }
  }

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

  const destroy = () => {
    // noop
  };

  const getEvent = async id => delokize((await events).get(id));

  const api = { commit, generate, query, destroy, getLatest, getEvent };

  api.DEV__swap = async newEvents => {
    const Events = await events;
    Events.clear();
    newEvents.forEach(evt => Events.insert(evt));
    db.saveDatabase();
  };

  api.DEV__getDriver = () => events;

  return api;
};

module.exports = adapter;
