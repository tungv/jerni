const path = require("path");
const startDevServer = require("./start-dev");
const socketIO = require("socket.io");
const getCollection = require("./utils/getCollection");
const kefir = require("kefir");

module.exports = async function subscribeDev(filepath, opts) {
  console.log("loading store");
  console.time("store loaded");
  const mod = await require(path.resolve(process.cwd(), filepath));
  const defExport = mod.default || mod;
  const store = await defExport;

  const adapter = require("@heq/server-lokijs");
  const ns = "local-dev";
  const queue = await adapter({
    ns
  });

  console.timeEnd("store loaded");

  console.log("starting server");

  console.time("server started");
  const server = await startDevServer({
    port: opts.port,
    queue
  });

  const io = socketIO(server);

  console.timeEnd("server started");

  const { port } = server.address();
  console.log({ port });

  store.replaceWriteTo(`http://localhost:${port}`);

  const { coll: Pulses, db } = await getCollection("jerni-dev.db", "pulses");

  let subscription;
  const doSubscribe = async () => {
    const stream = await store.subscribe();
    subscription = stream.observe(({ output }) => {
      console.log("pulse arrived");
      const pulse = {
        events: output.events,
        models: output.models.map(modelChange => ({
          model: {
            name: modelChange.model.name,
            version: modelChange.model.version
          },
          added: modelChange.added,
          modified: modelChange.modified,
          removed: modelChange.removed
        }))
      };

      const eventIdArray = pulse.events.map(e => e.id);
      Pulses.insert({ ...pulse, events: eventIdArray });
      db.saveDatabase();
      io.emit("redux event", { type: "SERVER/PULSE_ARRIVED", payload: pulse });
    });
  };

  doSubscribe();

  io.on("connection", socket => {
    socket.on("client action", async event => {
      if (event.type !== "RELOAD") {
        return;
      }

      // stop jerni-server subscription
      subscription.unsubscribe();
      const events = await queue.query({ from: 0 });

      const pulses = await getPulsesWithFullEvents(Pulses.find(), queue);

      console.log(pulses);

      Pulses.clear();
      db.saveDatabase();

      const pulses$ = kefir.sequentially(1, pulses.map(pulse => pulse.events));

      await store.replay(pulses$);
      doSubscribe();
    });
  });
  // process.exit(0);
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
