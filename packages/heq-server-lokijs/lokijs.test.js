const Loki = require('lokijs');
const tempy = require('tempy');
const adapter = require('.');

const test = require('ava');

const clean = async config => {
  const filepath = tempy.file({ extension: 'db' });
  const db = new Loki(filepath);

  const coll = db.addCollection(config.ns);
  coll.removeWhere({});
};

test('should commit', async t => {
  const queueConfig = { adapter: '@heq/server-fs', ns: '__test__' };

  clean(queueConfig);

  const queue = adapter(queueConfig);

  const event = {
    type: 'test',
    payload: { a: 1 },
    meta: {
      occurred_at: 1532408769402,
    },
  };

  const e1 = await queue.commit(event);
  t.deepEqual(e1, {
    id: 1,
    type: 'test',
    payload: { a: 1 },
    meta: {
      occurred_at: 1532408769402,
    },
  });

  const e2 = await queue.commit(event);
  t.deepEqual(e2, {
    id: 2,
    type: 'test',
    payload: { a: 1 },
    meta: {
      occurred_at: 1532408769402,
    },
  });

  queue.destroy();
});

test('should query in range', async t => {
  const queueConfig = { adapter: '@heq/server-fs', ns: '__test__' };

  clean(queueConfig);

  const queue = adapter(queueConfig);

  for (let i = 0; i < 10; ++i) {
    await queue.commit({ type: 'test', payload: i + 1 });
  }

  const events = await queue.query({ from: 2, to: 5 });

  t.log(events);

  t.deepEqual(events, [
    { id: 3, type: 'test', payload: 3 },
    { id: 4, type: 'test', payload: 4 },
    { id: 5, type: 'test', payload: 5 },
  ]);
  queue.destroy();
});

test('should query up to latest', async t => {
  const queueConfig = {
    ns: '__test__',
  };

  await clean(queueConfig);

  const queue = adapter(queueConfig);

  for (let i = 0; i < 10; ++i) {
    await queue.commit({ type: 'test', payload: i + 1 });
  }

  const events = await queue.query({ from: 2 });
  t.deepEqual(events, [
    { id: 3, type: 'test', payload: 3 },
    { id: 4, type: 'test', payload: 4 },
    { id: 5, type: 'test', payload: 5 },
    { id: 6, type: 'test', payload: 6 },
    { id: 7, type: 'test', payload: 7 },
    { id: 8, type: 'test', payload: 8 },
    { id: 9, type: 'test', payload: 9 },
    { id: 10, type: 'test', payload: 10 },
  ]);
});

test('should return [] when query if queue is empty', async t => {
  const queueConfig = {
    ns: '__test__',
  };

  await clean(queueConfig);

  const queue = adapter(queueConfig);

  const events = await queue.query({ from: 0 });
  t.deepEqual(events, []);
});

test('should get latest', async t => {
  const queueConfig = {
    ns: '__test__',
  };

  await clean(queueConfig);

  const queue = adapter(queueConfig);

  for (let i = 0; i < 10; ++i) {
    await queue.commit({ type: 'test', payload: i + 1 });
  }

  const latest = await queue.getLatest();
  t.deepEqual(latest, { id: 10, type: 'test', payload: 10 });
});

test('should return @@INIT if empty', async t => {
  const queueConfig = {
    ns: '__test__',
  };

  await clean(queueConfig);

  const queue = adapter(queueConfig);

  const latest = await queue.getLatest();
  t.deepEqual(latest, { id: 0, type: '@@INIT' });
});

test('should subscribe', t =>
  new Promise(async resolve => {
    const queueConfig = {
      ns: '__test__',
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    for (let i = 0; i < 5; ++i) {
      await queue.commit({ type: 'test', payload: i + 1 });
    }

    const { events$ } = queue.subscribe();

    const next5 = [];

    const subscription = events$.observe(v => {
      if (v.id <= 5) {
        // doesn't care first 5
        return;
      }

      next5.push(v);

      if (v.id === 10) {
        subscription.unsubscribe();
        queue.destroy();
        t.deepEqual(next5, [
          { id: 6, payload: 6, type: 'test' },
          { id: 7, payload: 7, type: 'test' },
          { id: 8, payload: 8, type: 'test' },
          { id: 9, payload: 9, type: 'test' },
          { id: 10, payload: 10, type: 'test' },
        ]);

        resolve();
      }
    });

    for (let i = 5; i < 10; ++i) {
      await queue.commit({ type: 'test', payload: i + 1 });
    }
  }));
