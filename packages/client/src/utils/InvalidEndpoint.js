module.exports = class InvalidEndpoint extends Error {
  constructor({ endpoint, reason }) {
    super(`INVALID_ENDPOINT: \`${endpoint}\` - reason: ${reason}`);
    this.data = {
      endpoint,
      reason,
    };
  }
};
