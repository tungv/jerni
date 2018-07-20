module.exports = class InvalidConfigError extends Error {
  constructor({ path, expected, actual }) {
    super(`INVALID_CONFIG: path=\`${path}\``);

    this.data = { path, expected, actual };
  }
};
