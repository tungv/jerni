module.exports = function makeTestStore(transform) {
  const db = [];
  let listeners = [];
  let checkpoint = 0;

  const store = {
    name: "test_store",
    meta: {},
    registerModels(map) {},
    subscribe(listener) {
      listeners.push(listeners);

      return () => {
        listeners = listeners.filter(fn => fn !== listener);
      };
    },
    async handleEvents(events) {
      db.push(...events.filter(event => event.id > checkpoint).map(transform));
      listeners.forEach(fn => fn(last(events).id));
      checkpoint = last(events).id;
      return `done ${last(events).id}`;
    },

    async getDriver() {
      return db;
    },

    async getLastSeenId() {
      return checkpoint;
    },
  };

  return store;
};

const last = array => (array.length >= 1 ? array[array.length - 1] : null);
