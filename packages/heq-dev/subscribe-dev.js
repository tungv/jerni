const path = require("path");
const startDevServer = require("./start-dev");
const socketIO = require("socket.io");
const getCollection = require("./utils/getCollection");
const kefir = require("kefir");

const measureTime = async (msg, block) => {
  try {
    console.time(msg);
    return await block();
  } finally {
    console.timeEnd(msg);
  }
};

const importPathWithInterop = async filepath => {
  const mod = await require(path.resolve(process.cwd(), filepath));
  return mod.default || mod;
};

module.exports = async function subscribeDev(filepath, opts) {
  const NAMESPACE = "local-dev";
  let subscription;

  // preparing store, and lokijs queue
  const { store, queue } = await measureTime("store loaded", async () => {
    const store = await importPathWithInterop(filepath);
    const adapter = require("@heq/server-lokijs");
    const queue = await adapter({ ns: NAMESPACE });
    return { store, queue };
  });

  // create server, rewrite store's `subscribe from` to local server
  const io = await measureTime("server started", async () => {
    const server = await startDevServer({
      port: opts.port,
      queue
    });

    const { port } = server.address();

    store.replaceWriteTo(`http://localhost:${port}`);

    return socketIO(server);
  });

  const { coll: Pulses, db } = await getCollection("jerni-dev.db", "pulses");

  const doSubscribe = async () => {
    const stream = await store.subscribe();
    subscription = stream.observe(rawPulse => {
      const pulse = normalizePulse(rawPulse);

      Pulses.insert(makePersistablePulse(pulse));
      db.saveDatabase();

      io.emit("redux event", { type: "SERVER/PULSE_ARRIVED", payload: pulse });
    });
  };

  await measureTime("subscription made", doSubscribe);

  const reload = async () => {
    // stop jerni-server subscription
    subscription.unsubscribe();

    // TODO: pause /commit endpoint

    const events = await queue.query({ from: 0 });
    const pulses = await getPulsesWithFullEvents(Pulses.find(), queue);

    Pulses.clear();
    db.saveDatabase();

    const pulses$ = kefir.sequentially(10, pulses.map(pulse => pulse.events));

    const newPulses = await store.replay(pulses$);
    newPulses.forEach(rawPulse => {
      Pulses.insert(makePersistablePulse(normalizePulse(rawPulse)));
    });
    db.saveDatabase();
    await doSubscribe();
  };

  let isReloading = false;
  io.on("connection", socket => {
    socket.on("client action", async event => {
      if (event.type !== "RELOAD") {
        return;
      }

      if (isReloading) return;

      isReloading = true;
      io.emit("redux event", {
        type: "SERVER/RELOADING"
      });
      await measureTime("reloaded", reload);
      io.emit("redux event", {
        type: "SERVER/RELOADED"
      });
      isReloading = false;
    });
  });
};

async function getPulsesWithFullEvents(pulses, queue) {
  return Promise.all(
    pulses.map(async p => {
      const { events, ...others } = p;
      const fullEvents = await Promise.all(
        events.map(id => queue.getEvent(id))
      );

      return { events: fullEvents, ...others };
    })
  );
}

const normalizePulse = ({ output, source }) => {
  const pulse = {
    events: output.events,
    models: output.models.map(modelChange => ({
      model: {
        source: source.name,
        name: modelChange.model.name,
        version: modelChange.model.version
      },
      added: modelChange.added,
      modified: modelChange.modified,
      removed: modelChange.removed
    }))
  };

  return pulse;
};

const makePersistablePulse = pulse => {
  const events = pulse.events.map(e => e.id);

  return Object.assign({}, pulse, { events });
};
