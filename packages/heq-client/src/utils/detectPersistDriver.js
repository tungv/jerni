const { URL } = require('url');
const path = require('path');

const packageByProtocol = {
  'mongodb:': '@events/snapshot-mongo',
};

module.exports = datasource => {
  const url = new URL(datasource);

  if (!url.protocol) {
    throw new InvalidEndpoint({
      endpoint: datasource,
      reason: `protocol is ${JSON.stringify(url.protocol)}`,
    });
  }

  return packageByProtocol[url.protocol];
};
