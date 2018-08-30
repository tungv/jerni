const Listr = require("listr");
const brighten = require("brighten");
const kefir = require("kefir");
const kleur = require("kleur");
const socketIO = require("socket.io");

const path = require("path");
const fs = require("fs");

const createProxy = require("./lib/store-proxy");
const getCollection = require("./utils/getCollection");
const startDevServer = require("./start-dev");
const open = require("./lib/open");

const NAMESPACE = "local-dev";
const DEV_DIR = path.resolve(process.cwd(), "./.jerni-dev");

process.on("exit", () => {
  fs.unlinkSync(path.resolve(DEV_DIR, "dev-server.txt"));
});

const startBanner = () => {
  const banner = `${kleur.bgGreen.bold.white(
    " jerni-dev "
  )} ${kleur.green.bold.underline("subscribe")}`;
  brighten();
  console.log(banner);
};

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

const initialTasks = new Listr([
  {
    title: "setup store and queue",
    task: async ctx => {
      return new Listr(
        [
          {
            title: "load store",
            task: async ctx => {
              ctx.store = await createProxy(
                path.resolve(process.cwd(), ctx.filepath),
                ctx.onChange
              );
            }
          },
          {
            title: "load queue",
            task: async ctx => {
              if (!fs.existsSync(DEV_DIR)) {
                fs.mkdirSync(DEV_DIR);
              }
              const adapter = require("@heq/server-lokijs");
              ctx.queue = await adapter({
                ns: NAMESPACE,
                filepath: path.resolve(DEV_DIR, "events.json")
              });
            }
          },
          {
            title: "load database",
            task: async ctx => {
              const { coll, db } = await getCollection(
                path.resolve(DEV_DIR, "pulses.json"),
                "pulses"
              );

              normalizePulsesDatabase(coll);
              db.saveDatabase();

              ctx.Pulses = coll;
              ctx.db = db;
            }
          }
        ],
        { concurrent: true }
      );
    }
  },

  {
    title: "compare versions",
    task: async (ctx, task) => {
      const { queue, store, opts } = ctx;
      const { id: latestServerVersion } = await queue.getLatest();
      const lastestStoreVersion = await store.DEV__getNewestVersion();

      if (lastestStoreVersion > latestServerVersion) {
        task.title = `server is behind store!`;

        if (opts.force) {
          await store.DEV__cleanAll();
        } else {
          throw new Error(
            `Server ID = ${latestServerVersion}. Store Id = ${lastestStoreVersion}`
          );
        }
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

      const { port } = server.address();
      const serverUrl = `http://localhost:${port}`;
      ctx.serverUrl = serverUrl;

      task.title = `jerni-server started! POST to ${serverUrl}/commit to commit new events`;

      fs.writeFileSync(path.resolve(DEV_DIR, "dev-server.txt"), serverUrl);
      store.DEV__replaceWriteTo(serverUrl);

      ctx.io = socketIO(server);
    }
  },
  {
    title: "open web UI",
    skip: ctx => ctx.opts.open === false,
    task: ctx => {
      open(ctx.serverUrl);
    }
  },
  {
    title: "start realtime subscription",
    task: startRealtime
  }
]);

const reloadTasks = new Listr([
  {
    title: "preparing",
    task: (ctx, task) => {
      const { reduxEvent } = ctx;
      switch (reduxEvent.type) {
        case "EVENT_DEACTIVATED":
          ctx.filter = evt =>
            !isDeactivated(evt) && evt.id === reduxEvent.payload ? -1 : 0;
          break;

        case "EVENT_REACTIVATED":
          ctx.filter = evt =>
            isDeactivated(evt) && evt.id === reduxEvent.payload ? 1 : 0;
          break;

        default:
          ctx.filter = () => 0;
      }

      task.title = "prepared";
    }
  },
  {
    title: "cleaning destinations",
    task: async (ctx, task) => {
      const { store, subscription, filter } = ctx;
      // stop jerni-server subscription
      subscription.unsubscribe();
      await store.DEV__cleanAll();
      task.title = "destinations cleaned";
    }
  },
  {
    title: "constructing new journey",
    task: async (ctx, task) => {
      const { filter, queue, Pulses, db } = ctx;

      const events = await queue.query({ from: 0 });
      const pulses = await getPulsesWithFullEvents(Pulses.find(), queue);

      // I know what I'm doing with let
      let id = 0;
      const newEvents = [];

      pulses.forEach(pulse => {
        pulse.events.forEach(event => {
          const shouldKeep = filter(event);
          if (shouldKeep === 1) {
            activateEvent(event);
          } else if (shouldKeep === -1) {
            deactivateEvent(event);
          }

          newEvents.push(event);
        });
      });

      await queue.DEV__swap(newEvents);

      ctx.incoming$ = kefir.sequentially(5, pulses.map(p => p.events));
      task.title = "new journey constructed";
    }
  },
  {
    title: "replay",
    task: async (_, task) => {
      return new Listr([
        {
          title: "replay",
          task: async ctx => {
            const { Pulses, store, incoming$ } = ctx;

            const stream = await store.subscribe(incoming$);

            ctx.newPulses = [];

            return stream
              .map(normalizePulse)
              .map(pulse => {
                ctx.newPulses.push(pulse);
                const lastEvent = pulse.events[pulse.events.length - 1];
                return `#${lastEvent.id} - ${lastEvent.type}`;
              })
              .toESObservable();
          }
        },
        {
          title: "finishing replay",
          task: () => (task.title = "replayed")
        }
      ]);
    }
  },
  {
    title: "flushing",
    task: (ctx, task) => {
      const { db, io, newPulses, Pulses } = ctx;

      Pulses.clear();
      newPulses.forEach(pulse => Pulses.insert(makePersistablePulse(pulse)));
      db.saveDatabase();

      io.emit("redux event", {
        type: "PULSES_INITIALIZED",
        payload: newPulses.slice(0, 50)
      });

      task.title = "flushed";
    }
  },
  {
    title: "switch to realtime",
    task: startRealtime
  }
]);

module.exports = async function subscribeDev(filepath, opts) {
  try {
    startBanner();
    let ctx = await initialTasks.run({
      filepath,
      opts,
      onChange: () => {
        reload({ type: "RELOAD" });
      }
    });
    console.log("\n");

    let isReloading = false;

    const reload = async reduxEvent => {
      isReloading = true;
      ctx.io.emit("redux event", { type: "SERVER/RELOADING" });

      ctx = await reloadTasks.run({ ...ctx, reduxEvent });

      ctx.io.emit("redux event", { type: "SERVER/RELOADED" });
      isReloading = false;
    };

    ctx.io.on("connection", socket => {
      socket.on("client action", async reduxEvent => {
        if (
          reduxEvent.type !== "RELOAD" &&
          reduxEvent.type !== "EVENT_DEACTIVATED" &&
          reduxEvent.type !== "EVENT_REACTIVATED"
        ) {
          return;
        }

        if (isReloading) return;

        brighten();
        console.log(
          `${kleur.bgGreen.bold(" jerni-dev ")} ${kleur.bold(reduxEvent.type)}`
        );
        await reload(reduxEvent);
      });
    });
  } catch (ex) {
    process.exit(1);
  }
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
