const kefir = require("kefir");

const DEBUG = process.env.DEBUG === "true";
const CAP_SIZE = 5242880;

const getCollection = async (db, name = "notification") => {
  const actualName = `QUEUE__${name}`;

  DEBUG && console.debug(`retrieving existing`);
  const existing = db.collection(actualName);
  try {
    if (await existing.isCapped()) {
      DEBUG && console.debug(`reused`);
      return existing;
    } else {
      DEBUG && console.debug("dropping");
      await db.dropCollection(actualName);
    }
  } catch (ex) {
    DEBUG && console.debug("cannot reuse");
  }

  DEBUG && console.debug(`create new capped collection ${actualName}`);

  try {
    const coll = await db.createCollection(actualName, {
      capped: true,
      size: CAP_SIZE,
      max: 1000
    });
    DEBUG && console.debug(`created`);

    return coll;
  } catch (ex) {
    // race conditions that happen in parallel creation of a queue. This only occures in test env
    return db.collection(actualName);
  }
};

const createCommitter = async (db, name) => {
  DEBUG && console.log("get committer");
  let coll = await getCollection(db, name);
  return data => {
    DEBUG && console.debug("mongo queue committing", data.event_id);
    return coll.insertMany(
      data.models.map(model => ({
        source: data.source,
        model: model.name,
        model_version: model.version,
        event_id: data.event_id
      }))
    );
  };
};

const createSubscriber = async (db, models, name) => {
  DEBUG && console.log("get subscriber");
  let coll = await getCollection(db, name);
  let listeners = [];

  const condition = {
    $or: models.map(m => ({ model: m.name, model_version: m.version }))
  };

  const startSubscription = async () => {
    const stream = await makeStream(coll, condition);
    subscription = stream
      .scan((latestId, data) => {
        return Math.max(latestId, data.event_id);
      }, 0)
      .observe(latestId => {
        listeners.forEach(fn => fn(latestId));
      });
  };

  return handler => {
    listeners.push(handler);

    if (listeners.length === 1) {
      DEBUG && console.info("start subscribing");
      startSubscription();
    }

    return () => {
      listeners = listeners.filter(fn => fn !== handler);
      if (listeners.length === 0) {
        DEBUG && console.info("stop subscribing");
        subscription && subscription.unsubscribe();
      }
    };
  };
};

const keepCalling = fn => {
  const call = async resolve => {
    const result = await fn();

    if (result) {
      resolve(result);
    } else {
      setTimeout(() => {
        call(resolve);
      }, 100);
    }
  };

  return new Promise(call);
};

const makeStream = async (coll, condition) => {
  try {
    const pool = kefir.pool();

    const start = () => {
      return kefir.stream(emitter => {
        let cursor = null;
        let aborted = false;

        keepCalling(() =>
          coll
            .find(condition)
            .sort({ $natural: -1 })
            .limit(1)
            .next()
            .catch(ex => {
              emitter.error(ex);
            })
        ).then(async startFrom => {
          DEBUG && console.debug("startFrom", startFrom);

          const streamingQuery = startFrom
            ? {
                $and: [condition, { event_id: { $gt: startFrom.event_id } }]
              }
            : condition;

          if (!aborted) {
            cursor = await coll.find(streamingQuery, {
              tailable: true,
              awaitData: true,
              noCursorTimeout: true,
              numberOfRetries: Number.MAX_VALUE
            });

            emitter.emit(startFrom || { event_id: 0 });
            const stream = cursor.stream();
            stream.on("data", data => {
              emitter.emit(data);
            });
            stream.on("error", error => {
              DEBUG && console.error("error", error);
              emitter.error(error);
            });
            stream.on("end", () => {
              DEBUG && console.debug("tailable query ends, retrying...");
              emitter.end();

              pool.plug(start());
            });
          }
        });

        return () => {
          aborted = true;
          cursor && cursor.close();
        };
      });
    };

    pool.plug(start());
    return pool;
  } catch (ex) {
    DEBUG && console.error(ex);
  }
};

exports.DEV__clean = async (db, name = "notification") => {
  if (process.env.NODE_ENV !== "production") {
    DEBUG && console.debug("dropping");
    try {
      await db.dropCollection(`QUEUE__${name}`);
    } catch (ex) {
    } finally {
      DEBUG && console.debug("dropped");
    }
  }
};

exports.createSubscriber = createSubscriber;
exports.createCommitter = createCommitter;
