const socketIO = require("socket.io");
const Listr = require("listr");
const kefir = require("kefir");
const brighten = require("brighten");
const path = require("path");

const createProxy = require("./lib/store-proxy");
const getCollection = require("./utils/getCollection");
const startDevServer = require("./start-dev");

const NAMESPACE = "local-dev";

const startRealtime = async (ctx, task) => {
  const { store, io, db, Pulses } = ctx;

  const outgoing$ = await store.subscribe();
  ctx.subscription = outgoing$.observe(rawPulse => {
    const pulse = normalizePulse(rawPulse);

    Pulses.insert(makePersistablePulse(pulse));
    db.saveDatabase();

    io.emit("redux event", { type: "SERVER/PULSE_ARRIVED", payload: pulse });
  });

  task.title = "listening for new events";
};

const tasks = new Listr([
  {
    title: "setup store and queue",
    task: async ctx => {
      return new Listr(
        [
          {
            title: "load store",
            task: async ctx => {
              ctx.store = await createProxy(
                path.resolve(process.cwd(), ctx.filepath)
              );
            }
          },
          {
            title: "load queue",
            task: async ctx => {
              const adapter = require("@heq/server-lokijs");
              ctx.queue = await adapter({ ns: NAMESPACE });
            }
          },
          {
            title: "load database",
            task: async ctx => {
              const { coll, db } = await getCollection(
                "jerni-dev.db",
                "pulses"
              );

              (ctx.Pulses = coll), (ctx.db = db);
            }
          }
        ],
        { concurrent: true }
      );
    }
  },

  {
    title: "normalizing database",
    task: async ctx => {
      const { Pulses, db } = ctx;
      normalizePulsesDatabase(Pulses);
      db.saveDatabase();
    }
  },
  {
    title: "compare versions",
    task: async (ctx, task) => {
      const { queue, store } = ctx;
      const { id: latestServerVersion } = await queue.getLatest();
      const lastestStoreVersion = await store.DEV__getNewestVersion();

      if (lastestStoreVersion > latestServerVersion) {
        task.title = `server is behind store!`;

        throw new Error(
          `Server ID = ${latestServerVersion}. Store Id = ${lastestStoreVersion}`
        );
      }

      if (lastestStoreVersion === lastestStoreVersion) {
        task.title = `store has caught up with server at #${lastestStoreVersion}`;
      } else {
        task.title = `starting to subscribe from #${lastestStoreVersion}. Server is at ${lastestStoreVersion}`;
      }
    }
  },
  {
    title: "starting http server",
    task: async (ctx, task) => {
      const { store, queue, opts } = ctx;
      const server = await startDevServer({
        port: opts.port,
        queue
      });

      brighten();
      const { port } = server.address();
      const serverUrl = `http://localhost:${port}`;
      task.title = `jerni-server started! POST to ${serverUrl}/commit to commit new events`;

      store.DEV__replaceWriteTo(`http://localhost:${port}`);

      ctx.io = socketIO(server);
    }
  },
  {
    title: "start realtime subscription",
    task: startRealtime
  }
]);

const measureTime = async (msg, block) => {
  try {
    console.time(msg);
    return await block();
  } finally {
    console.timeEnd(msg);
  }
};

module.exports = async function subscribeDev(filepath, opts) {
  try {
    const ctx = await tasks.run({ filepath, opts });
    console.log("\n");
  } catch (ex) {
    process.exit(1);
  }

  // const NAMESPACE = "local-dev";
  // let subscription;
  //
  //
  // const reload = async filterEvent => {
  //   // stop jerni-server subscription
  //   subscription.unsubscribe();
  //
  //   await measureTime("clean all sources", store.DEV__cleanAll);
  //
  //   const history$ = await measureTime(
  //     "constructing history stream",
  //     async () => {
  //       const events = await queue.query({ from: 0 });
  //       const pulses = await getPulsesWithFullEvents(Pulses.find(), queue);
  //
  //       Pulses.clear();
  //       db.saveDatabase();
  //
  //       // I know what I'm doing with let
  //       let id = 0;
  //       const newEvents = [];
  //
  //       pulses.forEach(pulse => {
  //         pulse.events.forEach(event => {
  //           const shouldKeep = filterEvent(event);
  //           if (shouldKeep === 1) {
  //             activateEvent(event);
  //           } else if (shouldKeep === -1) {
  //             deactivateEvent(event);
  //           }
  //
  //           newEvents.push(event);
  //         });
  //       });
  //
  //       await queue.DEV__swap(newEvents);
  //
  //       return kefir.sequentially(5, pulses.map(p => p.events));
  //     }
  //   );
  //
  //   const newPulses = await measureTime("replay history", async () => {
  //     const stream = await store.subscribe(history$);
  //
  //     return stream.thru(toArray).toPromise();
  //   });
  //
  //   const normalizedPulses = newPulses.map(normalizePulse);
  //
  //   normalizedPulses.forEach(pulse => {
  //     Pulses.insert(makePersistablePulse(pulse));
  //   });
  //   db.saveDatabase();
  //
  //   io.emit("redux event", {
  //     type: "PULSES_INITIALIZED",
  //     payload: normalizedPulses
  //   });
  //
  //   await startRealtime();
  // };
  //
  // let isReloading = false;
  // io.on("connection", socket => {
  //   socket.on("client action", async reduxEvent => {
  //     if (
  //       reduxEvent.type !== "RELOAD" &&
  //       reduxEvent.type !== "EVENT_DEACTIVATED" &&
  //       reduxEvent.type !== "EVENT_REACTIVATED"
  //     ) {
  //       return;
  //     }
  //
  //     if (isReloading) return;
  //
  //     isReloading = true;
  //     io.emit("redux event", { type: "SERVER/RELOADING" });
  //
  //     let filter = () => 0;
  //     if (reduxEvent.type === "EVENT_DEACTIVATED") {
  //       filter = evt =>
  //         !isDeactivated(evt) && evt.id === reduxEvent.payload ? -1 : 0;
  //     }
  //     if (reduxEvent.type === "EVENT_REACTIVATED") {
  //       filter = evt =>
  //         isDeactivated(evt) && evt.id === reduxEvent.payload ? 1 : 0;
  //     }
  //
  //     await measureTime("reloaded", () => reload(filter));
  //
  //     io.emit("redux event", { type: "SERVER/RELOADED" });
  //     isReloading = false;
  //   });
  // });
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

const normalizePulsesDatabase = Pulses => {
  const pulses = Pulses.find({});
  Pulses.clear();

  const eventIds = {};

  pulses.forEach(pulse => {
    const events = pulse.events.filter(id => {
      if (eventIds[id]) {
        return false;
      }

      eventIds[id] = true;
      return true;
    });

    if (events.length) {
      Pulses.insert({
        events,
        models: pulse.models
      });
    }
  });
};
