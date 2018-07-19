const enableDestroy = require('server-destroy');
const got = require('got');
const ports = require('port-authority');
const redis = require('redis');
const factory = require('../factory');

const clean = async config =>
  new Promise(resolve => {
    const client = redis.createClient({ url: config.url });

    client.del([`{${config.ns}}::id`, `{${config.ns}}::events`], () => {
      client.quit(resolve);
    });
  });

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

it('should able to subscribe from a past event id with redis adapter', async done => {
  const port = await ports.find(30100);
  const { start } = await factory({
    http: { port },
    queue: {
      driver: '@heq/server-redis',
      url: 'redis://localhost:6379/2',
      ns: '__test__',
    },
  });

  await clean({
    driver: '@heq/server-redis',
    url: 'redis://localhost:6379/2',
    ns: '__test__',
  });

  const server = await start();
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
