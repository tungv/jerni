module.exports = class DriverNotFoundError extends Error {
  constructor(moduleName) {
    super(`MODULE_NOT_FOUND: ${JSON.stringify(moduleName)}`);
  }
};
