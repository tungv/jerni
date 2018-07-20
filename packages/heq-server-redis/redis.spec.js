const adapter = require('./index');
const redis = require('redis');

const clean = async config =>
  new Promise(resolve => {
    const client = redis.createClient({ url: config.url });

    client.del([`{${config.ns}}::id`, `{${config.ns}}::events`], () => {
      client.quit(resolve);
    });
  });

describe('redis adapter', () => {
  it('should commit', async () => {
    const queueConfig = {
      driver: '@heq/redis-server',
      url: 'redis://localhost:6379/2',
      ns: '__test__',
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    const event = {
      type: 'test',
      payload: { a: 1 },
    };

    const e1 = await queue.commit(event);

    expect(e1).toEqual({
      id: 1,
      type: 'test',
      payload: { a: 1 },
    });

    const e2 = await queue.commit(event);

    expect(e2).toEqual({
      id: 2,
      type: 'test',
      payload: { a: 1 },
    });

    queue.destroy();
  });

  it('should query in range', async () => {
    const queueConfig = {
      driver: '@heq/redis-server',
      url: 'redis://localhost:6379/2',
      ns: '__test__',
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    for (let i = 0; i < 10; ++i) {
      await queue.commit({ type: 'test', payload: i + 1 });
    }

    const events = await queue.query({ from: 2, to: 5 });
    expect(events).toEqual([
      { id: 3, type: 'test', payload: 3 },
      { id: 4, type: 'test', payload: 4 },
      { id: 5, type: 'test', payload: 5 },
    ]);
    queue.destroy();
  });

  it('should query up to latest', async () => {
    const queueConfig = {
      driver: '@heq/redis-server',
      url: 'redis://localhost:6379/2',
      ns: '__test__',
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    for (let i = 0; i < 10; ++i) {
      await queue.commit({ type: 'test', payload: i + 1 });
    }

    const events = await queue.query({ from: 2 });
    expect(events).toEqual([
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

  it('should get latest', async () => {
    const queueConfig = {
      driver: '@heq/redis-server',
      url: 'redis://localhost:6379/2',
      ns: '__test__',
    };

    await clean(queueConfig);

    const queue = adapter(queueConfig);

    for (let i = 0; i < 10; ++i) {
      await queue.commit({ type: 'test', payload: i + 1 });
    }

    const latest = await queue.getLatest();
    expect(latest).toEqual({ id: 10, type: 'test', payload: 10 });
  });

  it('should subscribe', async done => {
    const queueConfig = {
      driver: '@heq/redis-server',
      url: 'redis://localhost:6379/2',
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
        expect(next5).toEqual([
          { id: 6, payload: 6, type: 'test' },
          { id: 7, payload: 7, type: 'test' },
          { id: 8, payload: 8, type: 'test' },
          { id: 9, payload: 9, type: 'test' },
          { id: 10, payload: 10, type: 'test' },
        ]);

        done();
      }
    });

    for (let i = 5; i < 10; ++i) {
      await queue.commit({ type: 'test', payload: i + 1 });
    }
  });
});
