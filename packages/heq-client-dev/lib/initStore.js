const got = require('got');
const readPkgUp = require('read-pkg-up');
const { pkg: packageJSON } = readPkgUp.sync();

module.exports = function initStore({ writeTo, readForm }) {
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

  const waitFor = async event => {};

  return {
    read,
    commit,
    waitFor,
  };
};
