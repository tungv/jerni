const kefir = require("kefir");
const MongoOplog = require("@tungv/mongo-oplog");

const watchWithoutReplicaSet = (collection, models) => {
  const condition = {
    $or: models.map(m => ({ name: m.name, version: m.version }))
  };

  let version = 0;

  return kefir.stream(emitter => {
    const intervalID = setInterval(async () => {
      const resp = await collection.find(condition).toArray();

      const oldestVersion = resp.reduce((v, obj) => {
        if (obj.__v > v) {
          return obj.__v;
        }
        return v;
      }, version);

      if (oldestVersion > version) {
        version = oldestVersion;
        emitter.emit(version);
      }
    }, 100);

    return () => {
      clearInterval(intervalID);
    };
  });
};

const watchWithChangeStream = (client, namespace, models) => {
  const oplog = MongoOplog(client.db("local"), { ns: namespace });

  const condition = {
    $or: models.map(m => ({ name: m.name, version: m.version }))
  };

  let version = 0;

  return kefir.stream(async emitter => {
    oplog.on("error", error => {
      emitter.error(error);
    });

    await oplog.tail();
    oplog.on("update", doc => {
      if (doc.o.$set.__v) {
        emitter.emit(doc.o.$set.__v);
      }
    });

    return () => {
      oplog.stop();
    };
  });
};

exports.watchWithoutReplicaSet = watchWithoutReplicaSet;
exports.watchWithChangeStream = watchWithChangeStream;

const once = fn => {
  let run = false;
  return (...args) => {
    if (!run) {
      run = true;
      fn(...args);
    }
  };
};

const logRealtime = once(() =>
  console.log("@jerni/store-mongo: receive signal in realtime")
);
const logInterval = once(() =>
  console.log("@jerni/store-mongo: receive signal by polling every 100ms")
);

module.exports = (client, snapshotCol, models) => {
  return kefir.stream(async emitter => {
    const condition = {
      $or: models.map(m => ({ name: m.name, version: m.version }))
    };

    const resp = await snapshotCol.find(condition).toArray();

    const oldestVersion = resp.reduce((v, obj) => {
      if (obj.__v > v) {
        return obj.__v;
      }
      return v;
    }, 0);

    emitter.emit(oldestVersion);

    // try realtime op logs first

    const streamRealtime = watchWithChangeStream(
      client,
      snapshotCol.namespace,
      models
    );

    let subscription = null;

    subscription = streamRealtime.observe(
      id => {
        logRealtime();
        emitter.emit(id);
      },
      error => {
        subscription.unsubscribe();

        const streamInterval = watchWithoutReplicaSet(snapshotCol, models);
        subscription = streamInterval.observe(
          id => {
            logInterval();
            emitter.emit(id);
          },
          intervalError => {
            emitter.error(intervalError);
            emitter.end();
          }
        );
      }
    );

    return () => subscription.unsubscribe();
  });
};
