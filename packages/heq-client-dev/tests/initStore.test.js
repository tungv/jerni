const mitt = require('mitt');
const test = require('ava');

const { version, name } = require('../package.json');
const initStore = require('../lib/initStore');
const makeServer = require('./makeServer');
const DummyModel = require('./DummyModel');

test('initStore to return a store', t => {
  const dumpConnectedModel = new DummyModel();

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

  const dumpConnectedModel = new DummyModel();

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
  t.deepEqual(event.meta.some, 'meta');
  t.deepEqual(event.meta.client, name);
  t.deepEqual(event.meta.clientVersion, version);

  t.true(event.meta.occurred_at - now >= 0 && event.meta.occurred_at - now < 5);

  server.close();
});

test('store should return specific driver instance', async t => {
  const model1 = new DummyModel('internal_1');
  const model2 = new DummyModel('internal_2');
  const model3 = new DummyModel('internal_3');
  const model4 = new DummyModel('internal_4');

  const store = initStore({
    writeTo: 'http://localhost:8080',
    readFrom: [model1, model2, model3, model4],
  });

  t.is(store.read(model1), 'internal_1');
  t.is(store.read(model2), 'internal_2');
  t.is(store.read(model3), 'internal_3');
  t.is(store.read(model4), 'internal_4');
});

test('store should waitFor all models', async t => {
  const emitter1 = mitt();
  const emitter2 = mitt();
  const model1 = new DummyModel('internal_1', emitter1);
  const model2 = new DummyModel('internal_2', emitter2);

  const store = initStore({
    writeTo: 'http://localhost:8080',
    readFrom: [model1, model2],
  });

  const startWaiting = Date.now();
  let duration = 0;
  const waitPromise = store
    .waitFor({ id: 5 })
    .then(() => (duration = Date.now() - startWaiting));

  await sleep(50);
  emitter1.emit('event', { id: 5 });

  await sleep(50);
  emitter2.emit('event', { id: 5 });

  await waitPromise;
  t.true(duration > 100 && duration <= 120);
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
