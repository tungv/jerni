const JerniPersistenceTimeout = require("jerni/lib/JerniPersistenceTimeout");

module.exports = function getJerniDevInstance(originalJourney, initial = []) {
  const buffer = [];
  const committed = [];
  let write = 0;
  let read = 0;

  const ready$ = originalJourney.clean();

  async function flush() {
    const count = buffer.length;
    await originalJourney.handleEvents(buffer);
    buffer.length = 0;

    read += count;
  }

  const wrappedJourney = new Proxy(originalJourney, {
    get(target, property) {
      switch (property) {
        case "commit":
          return async function wrappedCommit(event) {
            await ready$;
            committed.push({ ...event });
            event.id = ++write;
            buffer.push(event);

            process.nextTick(flush);

            return event;
          };

        case "waitFor":
          return async function wrappedWaitFor(event, timeout = 3000) {
            const start = Date.now();
            if (timeout < 0) {
              throw new JerniPersistenceTimeout(event);
            }
            if (read >= event.id) return;

            await sleep(10);
            const elapsed = Date.now() - start;
            return wrappedWaitFor(event, timeout - elapsed);
          };

        case "committed":
          return committed;

        default:
          return target[property];
      }
    },
  });

  return wrappedJourney;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
