const JerniPersistenceTimeout = require("jerni/lib/JerniPersistenceTimeout");

module.exports = async function getJerniDevInstance(
  originalJourney,
  initial = [],
) {
  const buffer = [];
  const committed = [];
  let write = 0;
  let read = 0;

  await originalJourney.clean();
  if (initial.length > 0) {
    for (let i = 0; i < initial.length; ++i) {
      buffer[i] = initial[i];
      buffer[i].id = ++write;
    }
    await scheduleFlush();
  }

  let flushing = false;
  async function scheduleFlush() {
    if (flushing) {
      await sleep(10);
      return scheduleFlush();
    }

    flushing = true;
    await flush();
    flushing = false;
  }

  async function flush() {
    const count = buffer.length;
    if (count === 0) return;
    await originalJourney.handleEvents(buffer);
    buffer.length = 0;

    read += count;
  }

  const wrappedJourney = new Proxy(originalJourney, {
    get(target, property) {
      switch (property) {
        case "commit":
          return async function wrappedCommit(event) {
            committed.push({ ...event });
            event.id = ++write;
            buffer.push(event);

            process.nextTick(scheduleFlush);

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

        case "isPending":
          return write > read;

        default:
          return target[property];
      }
    },
  });

  return wrappedJourney;
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
