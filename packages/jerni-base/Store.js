const kefir = require("kefir");

const getIncludes = model =>
  model.meta || (model.transform ? model.transform.meta : null);

class Connection {
  constructor({ name, models = [], url } = {}) {
    this.name = name;
    this.models = models;
    this.url = url;

    this.meta = {
      includes: new Set(),
    };

    // check meta
    let hasMeta = false;
    for (let i = 0; i < models.length; ++i) {
      const model = models[i];
      const includes = getIncludes(model);

      if (includes) {
        if (!hasMeta && i === models.length - 1) {
          const msg = `Either every model has a meta or none does!
found a model [${model.name}] having no meta while others have.
        `;
          throw new Error(msg);
        }
        hasMeta = true;

        // merge meta
        includes.forEach(type => this.meta.includes.add(type));
      } else if (hasMeta) {
        const msg = `Either every model has a meta or none does!
found a model [${model.name}] having no meta while others have.
        `;
        throw new Error(msg);
      }
    }
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
            `One model cannot be registered multiple times`,
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
