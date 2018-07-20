const enableDestroy = require('server-destroy');
const got = require('got');
const http = require('http');
const ports = require('port-authority');
const micro = require('micro');

const factory = require('../factory');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const createServer = async port => {
  const config = {
    http: { port },
  };

  if (process.env.REDIS_E2E) {
    const { execSync } = require('child_process');

    execSync('redis-cli -n 2 flush');

    config.queue = {
      driver: '@heq/server-redis',
      url: 'redis://localhost:6379/2',
      ns: '__test__',
    };
  }

  const service = await factory();

  const server = micro(service);
  return new Promise(resolve => {
    server.listen(port, err => {
      resolve(server);
    });
  });
};

const commitSomething = async ({ port }) => {
  const { body } = await got(`http://localhost:${port}/commit`, {
    json: true,
    body: {
      type: 'TEST',
      payload: {
        key: 'value',
      },
    },
  });

  return body;
};

const simpleParse = buffer => {
  const chunks = buffer.split('\n\n').filter(x => x);

  if (chunks[0] !== ':ok') {
    throw new Error('not ok');
  }

  const events = chunks.map(ch => {
    const lines = ch.split('\n');
    if (lines[1] !== 'event: INCMSG') {
      return [];
    }

    return JSON.parse(lines[2].slice('data: '.length));
  });

  return [].concat(...events);
};

describe('factory()', () => {
  it('should return start function', async () => {
    const port = await ports.find(30000);
    const server = await createServer(port);
    server.close();

    expect(server).toBeInstanceOf(http.Server);
  });

  it('should able to commit', async () => {
    const port = await ports.find(30000);
    const server = await createServer(port);
    enableDestroy(server);

    const { body } = await got(`http://localhost:${port}/commit`, {
      json: true,
      body: {
        type: 'TEST',
        payload: {
          key: 'value',
        },
      },
    });

    server.destroy();

    expect(body).toEqual({ id: 1, payload: { key: 'value' }, type: 'TEST' });
  });

  it('should able to query', async () => {
    const port = await ports.find(30000);
    const server = await createServer(port);
    enableDestroy(server);

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const { body } = await got(`http://localhost:${port}/query`, {
      json: true,
      query: {
        lastEventId: 2,
      },
    });

    server.destroy();

    expect(body).toEqual([
      { id: 3, payload: { key: 'value' }, type: 'TEST' },
      { id: 4, payload: { key: 'value' }, type: 'TEST' },
      { id: 5, payload: { key: 'value' }, type: 'TEST' },
    ]);
  });

  it('should able to get latest event', async () => {
    const port = await ports.find(30000);
    const server = await createServer(port);
    enableDestroy(server);

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const { body } = await got(`http://localhost:${port}/events/latest`, {
      json: true,
      query: {
        lastEventId: 2,
      },
    });

    server.destroy();
    expect(body).toEqual({ id: 5, payload: { key: 'value' }, type: 'TEST' });
  });

  it('should able to subscribe', async done => {
    const port = await ports.find(30000);
    const server = await createServer(port);
    enableDestroy(server);

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const stream = got.stream(`http://localhost:${port}/subscribe`, {
      headers: {
        'Last-Event-ID': 2,
        'Burst-Time': 1,
      },
    });

    const buffer = [];

    stream.on('data', data => {
      const msg = String(data);

      buffer.push(msg);

      // stop after receiving event #5
      if (msg.slice(0, 5) === 'id: 5') {
        server.destroy();
      }
    });

    stream.on('end', () => {
      expect(simpleParse(buffer.join(''))).toEqual([
        { id: 3, payload: { key: 'value' }, type: 'TEST' },
        { id: 4, payload: { key: 'value' }, type: 'TEST' },
        { id: 5, payload: { key: 'value' }, type: 'TEST' },
      ]);
      done();
    });
  });

  it('should able to subscribe from a past event id', async done => {
    const port = await ports.find(30000);
    const server = await createServer(port);
    enableDestroy(server);

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const stream = got.stream(`http://localhost:${port}/subscribe`, {
      headers: {
        'Last-Event-ID': 2,
        'Burst-Time': 1,
      },
    });

    for (let i = 0; i < 5; ++i) await commitSomething({ port });

    const buffer = [];

    stream.on('data', data => {
      const msg = String(data);

      buffer.push(msg);

      // stop after receiving event #5

      const chunks = msg.split('\n\n');

      for (const chunk of chunks) {
        if (chunk.slice(0, 6) === 'id: 10') {
          server.destroy();
        }
      }
    });

    stream.on('end', () => {
      const events = simpleParse(buffer.join(''));

      expect(events).toEqual([
        { id: 3, payload: { key: 'value' }, type: 'TEST' },
        { id: 4, payload: { key: 'value' }, type: 'TEST' },
        { id: 5, payload: { key: 'value' }, type: 'TEST' },
        { id: 6, payload: { key: 'value' }, type: 'TEST' },
        { id: 7, payload: { key: 'value' }, type: 'TEST' },
        { id: 8, payload: { key: 'value' }, type: 'TEST' },
        { id: 9, payload: { key: 'value' }, type: 'TEST' },
        { id: 10, payload: { key: 'value' }, type: 'TEST' },
      ]);
      done();
    });
  });
});
