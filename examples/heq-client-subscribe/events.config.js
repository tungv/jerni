module.exports = {
  subscribe: {
    serverUrl: 'https://events.jerni.app',
  },
  persist: {
    store: 'mongodb://localhost:27017/heq-example',
  },
  transform: {
    rulePath: './index.js',
  },
};
