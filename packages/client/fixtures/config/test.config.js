module.exports = {
  subscribe: {
    serverUrl: 'http://localhost:43366',
  },
  persist: {
    store: 'mongodb://localhost/client_test',
  },
  transform: {
    rulePath: '../rules/user_management.js',
  },
  hotReload: {
    enabled: true,
  },
  monitor: {
    port: 43333,
  },
};
