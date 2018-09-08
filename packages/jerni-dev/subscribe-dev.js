const Listr = require("listr");
const brighten = require("brighten");
const colors = require("ansi-colors");
const socketIO = require("socket.io");

const fs = require("fs");
const kefir = require("kefir");
const path = require("path");

const { DEV_DIR } = require("./tasks/constants");
const createProxy = require("./lib/createProxy");
const last = require("./utils/last");
const loadDatabase = require("./tasks/loadDatabase");
const loadQueue = require("./tasks/load-queue");
const open = require("./lib/open");
const startDevServer = require("./start-dev");

const log4js = require("log4js");
const logger = log4js.getLogger("jerni/subscribe");

logger.level = "error";

const NAMESPACE = "local-dev";

let started = false;

process.on("exit", () => {
  if (started) {
    fs.unlinkSync(path.resolve(DEV_DIR, "dev-server.txt"));
  }
});

const startBanner = () => {
  const banner = `${colors.bgGreen.bold.white(
    " jerni-dev "
  )} ${colors.green.bold.underline("subscribe")}`;
  brighten();
  console.log(banner);
};

const emergencyExit = (title, error) => {
  brighten();

  const msg = `${colors.bold.bgRed(
    " FATAL "
  )} ${title}\n\n  ${error.message.split("\n").join("\n  ")}\n\n`;

  console.error(msg);

  process.exit(1);
};

const startRealtime = async (ctx, task) => {
  const { store, io, db, Pulses, queue } = ctx;

  const outgoing$ = await store.subscribe();
  ctx.subscription = outgoing$.observe(rawPulse => {
    const pulse = normalizePulse(rawPulse);
    const latestPulse = Pulses.count()
      ? Pulses.get(Pulses.max("$loki"))
      : { events: [0] };
    const latestEvent = last(latestPulse.events);

    const newerEvents = pulse.events.filter(event => event.id > latestEvent);

    if (newerEvents.length === 0) {
      return;
    }

    pulse.events = newerEvents;

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
              const filepath =
                ctx.filepath[0] === "+"
                  ? require.resolve(ctx.filepath.slice(1))
                  : path.resolve(process.cwd(), ctx.filepath);

              try {
                ctx.store = await createProxy(
                  path.resolve(process.cwd(), filepath),
                  ctx.onChange
                );
              } catch (ex) {
                emergencyExit("cannot load journey file", ex);
              }
            }
          },
          {
            title: "load queue",
            task: async ctx => {
              ctx.queue = await loadQueue();
            }
          },
          {
            title: "load database",
            task: async ctx => {
              Object.assign(ctx, await loadDatabase());
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
      started = true;
      store.DEV__replaceWriteTo(serverUrl);

      ctx.io = socketIO(server);
    }
  },
  {
    title: "open web UI",
    enabled: ctx => ctx.opts.open === true,
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
    title: "flushing",
    task: (ctx, task) => {
      const { db, io, newPulses, Pulses } = ctx;

      Pulses.clear();
      newPulses.forEach(pulse => Pulses.insert(makePersistablePulse(pulse)));
      db.saveDatabase();

      io.emit("redux event", {
        type: "PULSES_INITIALIZED",
        payload: newPulses
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
      onChange: () => reload({ type: "RELOAD" })
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
          `${colors.bgGreen.bold(" jerni-dev ")} ${colors.bold(
            reduxEvent.type
          )}`
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
