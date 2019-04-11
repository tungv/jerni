const mitt = require("mitt");

const Store = require("@jerni/base/Store");

exports.Store = class DummyStore extends Store {
  constructor({ name, models, emitter = mitt() }) {
    super({ name, models });

    this.name = name;
    this.emitter = emitter;

    this.listeners = [];
    this.latestDummyId = 0;

    emitter.on("event", event => {
      this.latestDummyId = event.id;
      this.listeners.forEach(listener => listener(event.id));
    });
  }

  async getLastSeenId() {
    return this.latestDummyId;
  }

  getDriver(model) {
    return `${model.name}@${this.name}`;
  }

  subscribe(fn) {
    this.listeners.push(fn);

    // unsubscribe
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  async receive(event$) {
    return event$
      .map(events => events.filter(e => e.id % 4 === 0))
      .filter(x => x.length)
      .map(events => ({
        events,
      }));
  }
};

exports.Model = class DummyModel {
  constructor({ name, meta }) {
    this.name = name;
    this.meta = meta;
  }

  toString() {
    return `[DummyModel ${this.name}]`;
  }
};
