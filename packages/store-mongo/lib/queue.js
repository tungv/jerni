const kefir = require("kefir");
const log4js = require("log4js");
const logger = log4js.getLogger("jerni/mongo-queue");

const CAP_SIZE = 5242880;

const getCollection = async (db, name = "notification") => {
  const actualName = `QUEUE__${name}`;

  logger.debug(`retrieving existing`);
  const existing = db.collection(actualName);
  try {
    if (await existing.isCapped()) {
      logger.debug(`reused`);
      return existing;
    } else {
      logger.debug("dropping");
      await db.dropCollection(actualName);
    }
  } catch (ex) {
    logger.debug("cannot reuse");
  }

  logger.debug(`create new capped collection ${actualName}`);

  const coll = await db.createCollection(actualName, {
    capped: true,
    size: CAP_SIZE,
    max: 1000
  });
  logger.debug(`created`);

  return coll;
};

const createCommitter = async (db, name) => {
  let coll = await getCollection(db, name);
  return data => {
    logger.debug("mongo queue committing", data.event_id);
    return coll.insertOne(data);
  };
};

const createSubscriber = async (db, models, name) => {
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
      logger.info("start subscribing");
      startSubscription();
    }

    return () => {
      listeners = listeners.filter(fn => fn !== handler);
      if (listeners.length === 0) {
        logger.info("stop subscribing");
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
        ).then(async startFrom => {
          logger.debug("startFrom", startFrom);

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
              logger.error("error", error);
              emitter.error(error);
            });
            stream.on("end", () => {
              logger.debug("tailable query ends, retrying...");
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
    logger.error(ex);
  }
};

exports.DEV__clean = async (db, name = "notification") => {
  if (process.env.NODE_ENV !== "production") {
    logger.debug("dropping");
    listeners = [];
    try {
      await db.dropCollection(`QUEUE__${name}`);
    } finally {
      logger.debug("queue created");
    }
  }
};

exports.createSubscriber = createSubscriber;
exports.createCommitter = createCommitter;
