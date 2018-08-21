const path = require('path');
const startDevServer = require('./start-dev');
const socketIO = require('socket.io');
const getCollection = require('./utils/getCollection');

module.exports = async function subscribeDev(filepath, opts) {
  console.log('loading store');
  console.time('store loaded');
  const mod = await require(path.resolve(process.cwd(), filepath));
  const defExport = mod.default || mod;
  const store = await defExport;

  const adapter = require('@heq/server-lokijs');
  const ns = 'local-dev';
  const queue = await adapter({
    ns,
  });

  console.timeEnd('store loaded');

  console.log('starting server');

  console.time('server started');
  const server = await startDevServer({
    port: opts.port,
    queue,
  });

  const io = socketIO(server);

  console.timeEnd('server started');

  const { port } = server.address();
  console.log({ port });

  store.replaceWriteTo(`http://localhost:${port}`);

  const stream = await store.subscribe();

  const { coll: Pulses, db } = await getCollection('jerni-dev.db', 'pulses');

  const subscription = stream.observe(({ output }) => {
    const pulse = {
      events: output.events,
      models: output.models.map(modelChange => ({
        model: {
          name: modelChange.model.name,
          version: modelChange.model.version,
        },
        added: modelChange.added,
        modified: modelChange.modified,
        removed: modelChange.removed,
      })),
    };

    const eventIdArray = pulse.events.map(e => e.id);
    Pulses.insert({ ...pulse, events: eventIdArray });
    db.saveDatabase();
    io.emit('redux event', { type: 'SERVER/PULSE_ARRIVED', payload: pulse });
  });
  // process.exit(0);
};
