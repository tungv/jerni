const last = require("./utils/last");
const kefir = require("kefir");

module.exports = async function proxy(journey) {
  const queue = await createQueue();
  const committed = [];
  let subscription = null;
  let ended = false;

  const output = new Proxy(journey, {
    get(target, prop) {
      switch (prop) {
        case "start":
          return async (initialEvents = []) => {
            subscription = await start(target, queue, initialEvents);
          };

        case "stop":
          return async () => {
            ended = true;
            if (subscription) {
              subscription.unsubscribe();
            }

            await journey.dispose();

            return committed;
          };

        case "commit":
          return async event => {
            if (ended) {
              throw new Error("jerni-dev/proxy has been stopped");
            }
            event.meta = event.meta || {};
            event.meta.sent_to = 'memory';
            event.meta.occurred_at = Date.now();
            event.meta.client = 'unit_test';
            event.meta.clientVersion = 'proxy';
            const res = queue.commit(event);
            committed.push(event);
            return res;
          };

        default:
          return target[prop];
      }
    },
  });
  return output;
};

async function createQueue() {
  const adapter = require("heq-server/src/adapters/in-memory");
  const queue = adapter();

  return queue;
}

async function start(journey, queue, initialEvents) {
  await journey.DEV__cleanAll();

  const events$ = kefir.stream(emitter => {
    let stopped = false;

    (async function () {
      for await (const buffer of queue.generate(0, 1, 1, [])) {
        if (stopped) return;
        if (buffer.length) {
          emitter.emit(buffer);
        }
      }
    })();

    return () => {
      stopped = true;
    };
  });

  // const { events$ } = queue.subscribe();

  const stream = await journey.subscribe(events$);
  const subscription = stream.observe();

  for (const event of initialEvents) {
    await queue.commit(event);
  }

  if (initialEvents.length) {
    await journey.waitFor(last(initialEvents));
  }

  return subscription;
}
