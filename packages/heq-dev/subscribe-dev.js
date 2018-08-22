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

    const [history$, events] = await measureTime(
      "constructing history stream",
      async () => {
        const events = await queue.query({ from: 0 });
        const pulses = await getPulsesWithFullEvents(Pulses.find(), queue);

        Pulses.clear();
        db.saveDatabase();

        // I know what I'm doing with let
        let id = 0;
        const newEvents = [];

        const filteredPulses = pulses
          .map(pulse =>
            pulse.events.filter(filterEvent).map(event => {
              event.id = ++id;
              newEvents.push(event);
              return event;
            })
          )
          .filter(events => events.length > 0);

        await queue.DEV__swap(newEvents);

        return [kefir.sequentially(5, filteredPulses), newEvents];
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

    normalizedPulses.forEach(p => {
      p.events = p.events.reverse();
    });

    io.emit("redux event", {
      type: "PULSES_INITIALIZED",
      payload: normalizedPulses
    });

    await startRealtime();
  };

  let isReloading = false;
  io.on("connection", socket => {
    socket.on("client action", async event => {
      if (event.type !== "RELOAD") {
        return;
      }

      if (isReloading) return;

      isReloading = true;
      io.emit("redux event", { type: "SERVER/RELOADING" });

      const filter =
        "payload" in event
          ? evt => !event.payload.id_not_in.includes(evt.id)
          : identity;

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
