const mitt = require('mitt');
class ReadModel {
  subscribe(fn) {}

  getReadOnlyInstance() {
    return null;
  }
}

class DummyModel extends ReadModel {
  constructor(name, emitter = mitt()) {
    super();
    this.name = name;
    this.listeners = [];

    emitter.on('event', event => {
      this.listeners.forEach(fn => fn(event.id));
    });
  }

  getReadOnlyInstance() {
    return this.name;
  }

  subscribe(fn) {
    this.listeners.push(fn);

    return () => {
      this.listeners = this.listeners.filter(lis => lis !== fn);
    };
  }
}
module.exports = DummyModel;
