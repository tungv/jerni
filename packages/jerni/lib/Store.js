const kefir = require("kefir");

class Connection {
  constructor({ name, models = [] } = {}) {
    this.name = name;
    this.models = models;
  }

  async getDriver() {
    return null;
  }

  get latestEventId() {
    return null;
  }

  registerModels(map) {
    this.models.forEach(model => {
      if (map.has(model)) {
        throw new Error(
          `model ${model} is already registered to this store.` +
            `One model cannot be registered multiple times`
        );
      }

      map.set(model, this);
    });
  }

  subscribe(fn) {
    // do nothing

    // unsubscribe fn
    return () => {};
  }

  async receive(inputKefirStream) {
    return kefir.never();
  }
}

module.exports = Connection;
