const kefir = require('kefir');

const watchWithoutReplicaSet = (colleciton, models) => {
  const condition = {
    $or: models.map(m => ({ name: m.name, version: m.version })),
  };

  let version = 0;

  return kefir.stream(emitter => {
    const intervalID = setInterval(async () => {
      const resp = await colleciton.find(condition).toArray();

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

exports.watchWithoutReplicaSet = watchWithoutReplicaSet;
