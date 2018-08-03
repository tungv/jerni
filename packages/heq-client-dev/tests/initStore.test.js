const test = require('ava');
const makeServer = require('./makeServer');
const initStore = require('../lib/initStore');
const { version, name } = require('../package.json');

test('initStore to return a store', t => {
  const dumpConnectedModel = {};

  const store = initStore({
    writeTo: 'http://localhost:8080',
    readFrom: [dumpConnectedModel],
  });

  t.true(typeof store.read === 'function');
  t.true(typeof store.commit === 'function');
  t.true(typeof store.waitFor === 'function');
});

test('store should be able to commit event', async t => {
  const { queue, server } = await makeServer({
    ns: 'test_commit',
    port: 18080,
  });

  const dumpConnectedModel = {};

  const store = initStore({
    writeTo: 'http://localhost:18080',
    readFrom: [dumpConnectedModel],
  });

  const now = Date.now();

  const event = await store.commit({
    type: 'TEST',
    payload: { key: 'value' },
    meta: { some: 'meta' },
  });

  t.truthy(event.id);
  t.deepEqual(event.type, 'TEST');
  t.deepEqual(event.payload, { key: 'value' });
  t.deepEqual(event.meta, {
    some: 'meta',
    occurred_at: now,
    client: name,
    clientVersion: version,
  });

  server.close();
});
