const brighten = require('brighten');
const subscribe = require('../lib/subscribe');
const initStore = require('../lib/initStore');
const test = require('ava');
const makeServer = require('./makeServer');
const { Connection: DummyConnection } = require('./DummyConnection');

test('should subscribe', async t => {
  brighten();
  const { queue, server } = await makeServer({
    ns: 'test_subscribe',
    port: 19090,
  });

  const dummyConnection = new DummyConnection({
    name: 'conn_0',
    models: [],
  });

  const store = initStore({
    writeTo: 'http://localhost:19090',
    readFrom: [dummyConnection],
  });

  for (let i = 0; i < 10; ++i) {
    await store.commit({
      type: 'TEST',
      payload: { key: 'value' },
      meta: { some: 'meta' },
    });
  }

  await sleep(100);

  const stream = await subscribe({
    subscribeURL: 'http://localhost:19090/subscribe',
    queryURL: 'http://localhost:19090/query',
    lastSeenId: 0,
  });

  const events = [];

  stream.observe(incomingEvents => {
    events.push(...incomingEvents);
  });

  for (let i = 0; i < 10; ++i) {
    await store.commit({
      type: 'TEST',
      payload: { key: 'value' },
      meta: { some: 'meta' },
    });
  }
  server.close();

  await sleep(100);
  const length = events.length;
  t.true(length === 20);
});

test('should subscribe with filter', async t => {
  brighten();
  const { queue, server } = await makeServer({
    ns: 'test_subscribe',
    port: 19091,
  });

  const dummyConnection = new DummyConnection({
    name: 'conn_0',
    models: [],
  });

  const store = initStore({
    writeTo: 'http://localhost:19091',
    readFrom: [dummyConnection],
  });

  for (let i = 0; i < 10; ++i) {
    await store.commit({
      type: `TEST_${i % 4}`,
      payload: { key: 'value' },
      meta: { some: 'meta' },
    });
  }

  await sleep(100);

  const stream = await subscribe({
    subscribeURL: 'http://localhost:19091/subscribe',
    queryURL: 'http://localhost:19091/query',
    lastSeenId: 0,
    includes: ['TEST_1', 'TEST_3'],
  });

  const events = [];

  stream.observe(incomingEvents => {
    events.push(...incomingEvents);
  });

  for (let i = 0; i < 10; ++i) {
    await store.commit({
      type: `TEST_${i % 4}`,
      payload: { key: 'value' },
      meta: { some: 'meta' },
    });
  }
  server.close();

  await sleep(100);
  const length = events.length;
  t.true(length === 10);
  t.deepEqual(events.map(event => event.id), [
    2,
    4,
    6,
    8,
    10,
    12,
    14,
    16,
    18,
    20,
  ]);
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
