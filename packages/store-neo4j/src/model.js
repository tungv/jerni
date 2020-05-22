module.exports = class Neo4jModel {
  constructor({ name, version, transform }) {
    this.name = name;
    this.version = version;
    this.transform = transform;
  }

  toString() {
    return `[Neo4JModel ${this.name}_v${this.version}]`;
  }
};
