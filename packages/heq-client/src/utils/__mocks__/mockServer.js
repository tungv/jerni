const createTestServer = require('create-test-server');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const mockServer = async (initialLatestId, events) => {
  let latestId = initialLatestId;
  const server = await createTestServer();

  const writeEvents = (res, events) => {
    if (!events.length) {
      return;
    }

    res.write(`id: ${events[events.length - 1].id}
event: INCMSG
data: ${JSON.stringify(events)}

`);
  };

  server.use((req, res, next) => {
    // console.log('req:', req.method, req.path);
    next();
  });

  server.get('/query', (req, res) => res.json([]));

  server.get('/events/latest', (req, res) => {
    // console.log('latest: ', latestId);
    const latestIndex = events.findIndex(e => e && e.id === latestId);
    res.send(events[latestIndex]);
  });

  server.get('/subscribe', async (req, res) => {
    const startId = Number(req.headers['last-event-id']) + 1;

    res.setHeader('content-type', 'text/event-stream');
    res.write(':ok\n\n');
    await delay(10);

    // console.log('first push: from %d to %d', startId, latestId);
    const startIndex = events.findIndex(e => e && e.id === startId);
    const latestIndex = events.findIndex(e => e && e.id === latestId);
    // console.log('index: %d to %d', startIndex, latestIndex);
    const initialEvents = events.slice(startIndex, latestIndex + 1);

    // console.log(initialEvents);

    writeEvents(res, initialEvents);
    let ended = false;

    for (const event of events.slice(latestIndex + 1)) {
      await delay(10);
      try {
        const actual =
          typeof event === 'function' ? await event() : await event;
        latestId = actual.id;
        if (ended) {
          return;
        } else {
          writeEvents(res, [actual]);
        }
      } catch (ex) {
        res.end('');
        ended = true;
        continue;
      }
    }
  });

  return server;
};

module.exports = mockServer;
