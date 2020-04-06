const { EventEmitter } = require("events");
const on = require("@async-generator/emitter-on");

module.exports = function makeTestStore(transform) {
  const db = [];
  let listeners = [];
  let checkpoint = 0;
  let hasStopped = false;

  const pubsub = new EventEmitter();

  const store = {
    name: "test_store",
    meta: transform.meta || {},
    registerModels(map) {},
    subscribe(listener) {
      console.log("subscribe");
      listeners.push(listener);

      return () => {
        console.log("notifying");
        listeners = listeners.filter(fn => fn !== listener);
      };
    },
    async handleEvents(events) {
      db.push(
        ...events.filter(event => event.id > checkpoint).flatMap(transform),
      );
      listeners.forEach(fn => fn(last(events).id));
      checkpoint = last(events).id;
      pubsub.emit("persisted", { id: checkpoint });
      return `done ${last(events).id}`;
    },

    async getDriver() {
      return db;
    },

    async getLastSeenId() {
      return checkpoint;
    },

    async *listen() {
      for await (const checkpoint of on(pubsub, "persisted")) {
        if (hasStopped) {
          break;
        }
        console.log(checkpoint);
        yield checkpoint;
      }
    },

    async clean() {},
    toString() {
      return "test store";
    },
    async dispose() {
      hasStopped = true;
    },
  };

  return store;
};

const last = array => (array.length >= 1 ? array[array.length - 1] : null);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
