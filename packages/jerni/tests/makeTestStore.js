module.exports = function makeTestStore(transform) {
  const db = [];
  let listeners = [];

  const store = {
    name: "test_store",
    meta: {
      includes: ["type_1", "type_2"],
    },
    registerModels(map) {},
    subscribe(listener) {
      listeners.push(listeners);

      return () => {
        listeners = listeners.filter(fn => fn !== listener);
      };
    },
    async handleEvents(events) {
      db.push(...events.map(transform));
      listeners.forEach(fn => fn(last(events).id));
      return `done ${last(events).id}`;
    },

    async getDriver() {
      return db;
    },

    async getLastSeenId() {
      const event = last(db);
      if (event) return event.id;
      return 0;
    },
  };

  return store;
};
