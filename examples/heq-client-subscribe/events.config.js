module.exports = {
  subscribe: {
    serverUrl: 'https://events.tung.ninja',
  },
  persist: {
    store: 'mongodb://localhost:27017/heq-example',
  },
  transform: {
    rulePath: './index.js',
  },
};
