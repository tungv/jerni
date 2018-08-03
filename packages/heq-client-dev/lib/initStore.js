const got = require('got');
const readPkgUp = require('read-pkg-up');

const makeDefer = require('./makeDefer');
const partition = require('./partition');

const { pkg: packageJSON } = readPkgUp.sync();

module.exports = function initStore({ writeTo, readFrom }) {
  const latestIds = readFrom.map(() => 0);
  let buffer = [];

  readFrom.forEach((model, index) => {
    model.subscribe(id => {
      const prevOldest = Math.min(...latestIds);
      latestIds[index] = id;
      const currentOldest = Math.min(...latestIds);

      if (currentOldest > prevOldest) {
        const [yes, no] = partition(buffer, ([id]) => id <= currentOldest);

        buffer = no;
        yes.forEach(([id, defer]) => defer.resolve());
      }
    });
  });

  const read = model => {
    return model.getInstance();
  };

  const commit = async event => {
    const finalEvent = {
      type: event.type,
      payload: event.payload,
      meta: {
        occurred_at: Date.now(),
        client: packageJSON.name,
        clientVersion: packageJSON.version,
        ...(event.meta || {}),
      },
    };
    const resp = await got.post(`${writeTo}/commit`, {
      json: true,
      body: finalEvent,
    });

    return resp.body;
  };

  const waitFor = async event => {
    const defer = makeDefer();
    buffer.push([event.id, defer]);

    return defer.promise;
  };

  return {
    read,
    commit,
    waitFor,
  };
};
