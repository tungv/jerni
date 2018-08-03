const readPkgUp = require('read-pkg-up');
const got = require('got');
const { pkg: packageJSON } = readPkgUp.sync();

module.exports = async (endpoint, event) => {
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
  const resp = await got.post(endpoint, {
    json: true,
    body: finalEvent,
  });

  return resp.body;
};
