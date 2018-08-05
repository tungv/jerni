const got = require('got');

const subscriber = require('@events/subscriber');

const { write } = require('./logger');

module.exports = async function getEventsStream({
  subscriptionConfig: { serverUrl, burstCount, burstTime },
  from,
}) {
  const latestEvent = await getLatestEvent(serverUrl);
  if (!latestEvent) {
    throw {
      type: 'err-server-disconnected',
      payload: {
        reason: `cannot connect to ${serverUrl}`,
      },
    };
  }

  if (!latestEvent.id) {
    latestEvent.id = 0;
  }

  const { raw$, events$, abort } = subscriber(`${serverUrl}/subscribe`, {
    'Last-Event-ID': from,
    'burst-count': burstCount,
    'burst-time': burstTime,
  });

  const ready = raw$
    .take(1)
    .toPromise()
    .then(() => Date.now());

  return {
    latestEvent,
    events$,
    ready,
  };
};

async function getLatestEvent(url) {
  try {
    write('SILLY', {
      type: 'inspect',
      payload: url,
    });
    const resp = await got(`${url}/events/latest`, {
      json: true,
    });
    return resp.body;
  } catch (ex) {
    return null;
  }
}
