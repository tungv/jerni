# heq-server

heq-server is a factory to create http server that follow heq protocol. The underlaying persistence layer and realtime notification can be implemented in adapters.

# Adapters

Official:

* [@heq/server-redis](https://npm.im/@heq/server-redis)

# Usage

It's recommended to use [`heq`](https://npm.im/heq) to start `heq-server` instances. However, if you
want to programmatically start `heq-server`, you can use this package directly.

The following example will show you how to initiate an heq-server using redis as the persistence and
realtime notification layer.

```js
const factory = require('heq-server');
const config = {
  http: {
    // required
    port: 3000,

    // optional
    commitPath: '/commit',
    subscribePath: '/subscribe',
    queryPath: '/query',
  },

  queue: {
    // specify the adapter
    driver: '@heq/server-redis',

    // adapter options - please consult the documentation of in-use adapter
    url: 'redis://localhost:6379/2',
    ns: 'sample',
  },
};

const heq = await factory(config);

// start and receive an http server on port 3000
// this server will respond to GET /query, GET /subscribe and POST /commit
const httpServer = await heq.start();
```
