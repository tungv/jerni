const tempfile = require("tempfile");

const { NAMESPACE } = require("./tasks/constants");

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
          return () => {
            ended = true;
            if (subscription) {
              subscription.unsubscribe();
            }

            return committed;
          };

        case "commit":
          return async event => {
            if (ended) {
              throw new Error("jerni-dev/proxy has been stopped");
            }
            const res = queue.commit(event);
            committed.push(event);
            return res;
          };

        default:
          return target[prop];
      }
    }
  });
  return output;
};

async function createQueue() {
  const adapter = require("@heq/server-lokijs");
  const queue = await adapter({
    ns: NAMESPACE,
    filepath: tempfile("events.json")
  });

  return queue;
}

async function start(journey, queue, initialEvents) {
  await journey.DEV__cleanAll();

  const { events$ } = queue.subscribe();

  const stream = await journey.subscribe(events$.map(evt => [evt]));
  const subscription = stream.observe();

  for (const event of initialEvents) {
    await queue.commit(event);
  }

  return subscription;
}
