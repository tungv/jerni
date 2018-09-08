const kefir = require("kefir");
const log4js = require("log4js");
const logger = log4js.getLogger("jerni/mongo-queue");

const CAP_SIZE = 5242880;

const create = async (db, name, models) => {
  logger.debug("getting collection");
  let coll = await getCollection(db, name);
  logger.debug("getting collection done");

  const condition = {
    $or: models.map(m => ({ model: m.name, model_version: m.version }))
  };

  let listeners = [];
  let subscription;

  const startSubscription = async () => {
    const stream = await makeStream(coll, condition);
    subscription = stream
      .scan((latestId, data) => {
        return Math.max(latestId, data.event_id);
      }, 0)
      .spy("latest id")
      .observe(latestId => {
        listeners.forEach(fn => fn(latestId));
      });
  };

  const commit = async data => {
    logger.debug("mongo queue committing", data.event_id);
    await coll.insertOne(data);
  };

  const subscribe = handler => {
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

  const queue = { commit, subscribe };

  if (process.env.NODE_ENV !== "production") {
    queue.DEV__clean = async () => {
      logger.debug("dropping");
      await db.dropCollection(`QUEUE__${name}`);
      coll = await getCollection(db, name);
    };
  } else {
    queue.DEV__clean = () => {};
  }

  logger.debug("queue created");
  return queue;
};

const getCollection = async (db, name) => {
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

    const start = async () => {
      const startFrom = await keepCalling(() =>
        coll
          .find(condition)
          .sort({ $natural: -1 })
          .limit(1)
          .next()
      );

      logger.debug("startFrom", startFrom);

      const streamingQuery = startFrom
        ? {
            $and: [condition, { event_id: { $gt: startFrom.event_id } }]
          }
        : condition;

      const cursor = await coll.find(streamingQuery, {
        tailable: true,
        awaitData: true,
        noCursorTimeout: true,
        numberOfRetries: Number.MAX_VALUE
      });

      return kefir.stream(emitter => {
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

          start().then(newStream => pool.plug(newStream));
        });

        return () => {
          cursor.close();
        };
      });
    };

    pool.plug(await start());
    return pool;
  } catch (ex) {
    logger.error(ex);
  }
};

module.exports = create;
