function adapter() {
  const events = [];
  let id = 0;

  const commit = event => {
    events[id] = event;
    event.id = ++id;
    return event;
  };

  const query = ({ from, to = id }) => {
    return events.slice(from, to);
  };

  const getLatest = () =>
    events.length === 0 ? { id: 0, type: "@@INIT" } : events[events.length - 1];

  async function* generate(from, max, time, includingTypes = []) {
    const buffer = [];
    let i = from;

    const filter = includingTypes.length
      ? event => includingTypes.includes(event.type)
      : alwaysTrue;

    while (true) {
      await sleep(time);
      for (; i < events.length; ++i) {
        const event = events[i];
        if (filter(event)) {
          buffer.push(event);

          if (buffer.length >= max) {
            yield buffer;
            buffer.length = 0;
          }
        }
      }
      yield buffer;
      buffer.length = 0;
    }
  }

  return { commit, query, getLatest, generate };
}

module.exports = adapter;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const alwaysTrue = () => true;
