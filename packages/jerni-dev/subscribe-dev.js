const socketIO = require("socket.io");

const kefir = require("kefir");
const path = require("path");

const getCollection = require("./utils/getCollection");
const startDevServer = require("./start-dev");

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

    store.DEV__replaceWriteTo(`http://localhost:${port}`);

    return socketIO(server);
  });

  const { coll: Pulses, db } = await getCollection("jerni-dev.db", "pulses");

  const startRealtime = async incoming$ => {
    const outgoing$ = await store.subscribe(incoming$);
    subscription = outgoing$.observe(rawPulse => {
      const pulse = normalizePulse(rawPulse);

      Pulses.insert(makePersistablePulse(pulse));
      db.saveDatabase();

      io.emit("redux event", { type: "SERVER/PULSE_ARRIVED", payload: pulse });
    });
  };

  await measureTime("subscription made", startRealtime);

  const reload = async filterEvent => {
    // stop jerni-server subscription
    subscription.unsubscribe();

    await measureTime("clean all sources", store.DEV__cleanAll);

    const history$ = await measureTime(
      "constructing history stream",
      async () => {
        const events = await queue.query({ from: 0 });
        const pulses = await getPulsesWithFullEvents(Pulses.find(), queue);

        Pulses.clear();
        db.saveDatabase();

        // I know what I'm doing with let
        let id = 0;
        const newEvents = [];

        pulses.forEach(pulse => {
          pulse.events.forEach(event => {
            const shouldKeep = filterEvent(event);
            if (shouldKeep === 1) {
              activateEvent(event);
            } else if (shouldKeep === -1) {
              deactivateEvent(event);
            }

            newEvents.push(event);
          });
        });

        await queue.DEV__swap(newEvents);

        return kefir.sequentially(5, pulses.map(p => p.events));
      }
    );

    const newPulses = await measureTime("replay history", async () => {
      const stream = await store.subscribe(history$);

      return stream.thru(toArray).toPromise();
    });

    const normalizedPulses = newPulses.map(normalizePulse);

    normalizedPulses.forEach(pulse => {
      Pulses.insert(makePersistablePulse(pulse));
    });
    db.saveDatabase();

    io.emit("redux event", {
      type: "PULSES_INITIALIZED",
      payload: normalizedPulses
    });

    await startRealtime();
  };

  let isReloading = false;
  io.on("connection", socket => {
    socket.on("client action", async reduxEvent => {
      if (
        reduxEvent.type !== "RELOAD" &&
        reduxEvent.type !== "EVENT_DEACTIVATED" &&
        reduxEvent.type !== "EVENT_REACTIVATED"
      ) {
        return;
      }

      if (isReloading) return;

      isReloading = true;
      io.emit("redux event", { type: "SERVER/RELOADING" });

      let filter = () => 0;
      if (reduxEvent.type === "EVENT_DEACTIVATED") {
        filter = evt =>
          !isDeactivated(evt) && evt.id === reduxEvent.payload ? -1 : 0;
      }
      if (reduxEvent.type === "EVENT_REACTIVATED") {
        filter = evt =>
          isDeactivated(evt) && evt.id === reduxEvent.payload ? 1 : 0;
      }

      await measureTime("reloaded", () => reload(filter));

      io.emit("redux event", { type: "SERVER/RELOADED" });
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

const toArray = stream$ => stream$.scan((prev, next) => prev.concat(next), []);
const identity = x => x;
const isDeactivated = evt => evt.type.startsWith("[MARKED_AS_DELETE]___");
const deactivateEvent = event => {
  event.type = `[MARKED_AS_DELETE]___${event.type}`;
};
const activateEvent = event => {
  event.type = event.type.split("[MARKED_AS_DELETE]___").join("");
};
