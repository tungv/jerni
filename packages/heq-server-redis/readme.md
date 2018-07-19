# Redis Adapter for heq-server

[heq-server](https://npm.im/heq-server) is a light-weight persistent and stateless message queue over http protocol. When starting heq-server with @heq/server-redis adapter, redis will be used as the persistence datastore

## Usage

```js
const adatper = require('@heq/server-redis')

// example
const queue = adatper({
  ns: 'some-namespace',
  url: 'redis://localhost:6379/1'
})

// commit
const committedEvent = await queue.commit({ type: 'some event', payload: { some: 'value' } });

// query
const events = await queue.query({ from: 5, to: 10 }); // omitting `to` to query up to the latest event

// subscription
const { events$ } = queue.subscribe();

const subscription = events$.observe(event => { /* ... */ });

// unsubscribe
subscription.unsubscribe()
```

## Configuration

This adapter requires 2 options

| option name | data type                | description                                                                                              |
| ----------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| url         | `string` &#124; `object` | must be an valid option that [`redis.createClient` receives](http://redis.js.org/#api-rediscreateclient) |
| ns          | `string`                 | a namespace to allowing multiple queues can be run in one instance of redis                              |
