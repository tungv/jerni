import execa from 'execa';
import got from 'got';

import { MongoClient } from 'mongodb';
import path from 'path';

import seedingEvents from '../fixtures/seeding-events';
import startServer, { cleanup } from '../fixtures/startServer';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const subscribe = async ({
  loglevel = 'DEBUG',
  configPath,
  json = true,
  keepAlive,
  debug = false,
}) => {
  const child = execa('node', ['-r', 'babel-register', './src/subscribe'], {
    silent: true,
    env: {
      params: JSON.stringify({
        json,
        verbose: loglevel,
        configPath: path.resolve(process.cwd(), configPath),
      }),
    },
  });

  setTimeout(() => {
    child.kill('SIGINT');
  }, keepAlive);

  if (debug) {
    child.stdout.pipe(process.stdout);
  }

  const { stdout, stderr } = await child;

  if (stderr) {
    throw stderr;
  }

  return { stdout };
};

const normalize = array =>
  array.map(item => {
    try {
      const obj = JSON.parse(item.split(process.cwd()).join('<ROOT>'));
      delete obj._t;

      return obj;
    } catch (ex) {
      console.error(item);
      throw ex;
    }
  });

describe('heq-client subscribe', () => {
  let server;
  let db;

  beforeAll(async () => {
    server = await startServer({
      redis: 'redis://localhost:6379/6',
      port: 43366,
      namespc: 'client-e2e-test',
      clean: true,
    });

    for (const event of seedingEvents) {
      await got.post(`http://localhost:43366/commit`, {
        body: event,
        json: true,
      });
    }

    db = await MongoClient.connect(process.env.MONGO_TEST);
  });

  afterEach(() => {
    cleanup();
  });

  test('happy path', async () => {
    await db.dropDatabase();
    const { stdout } = await subscribe({
      configPath: './fixtures/config/test.config.js',
      keepAlive: 3000,
    });

    const appEvents = normalize(stdout.split('\n'));

    expect(appEvents.map(e => e.type)).toMatchSnapshot('app events sequence');

    appEvents.filter(e => e.type === 'incoming-event').forEach((e, index) => {
      expect(e.payload.event.id).toBe(index + 1);
      expect(e).toMatchSnapshot(`incoming-event ${index + 1} must match`);
    });

    appEvents.filter(e => e.type === 'subscription-catchup').forEach(e => {
      expect(e.payload.count).toBe(9);
    });

    const users = await db
      .collection('users_v1.0.0')
      .find()
      .toArray();

    const departments = await db
      .collection('departments_v1.0.0')
      .find()
      .toArray();

    expect(users.map(({ _id, ...user }) => user)).toMatchSnapshot(
      'users collection must match'
    );
    expect(
      departments.map(({ _id, ...department }) => department)
    ).toMatchSnapshot('departments collection must match');
  });

  test('retry', async () => {
    await db.dropDatabase();
    const server1 = await startServer({
      redis: 'redis://localhost:6379/6',
      port: 43377,
      namespc: 'client-e2e-test-retry',
      clean: true,
    });

    const subscriberPromise = subscribe({
      configPath: './fixtures/config/retry.config.js',
      keepAlive: 3000,
    });

    // wait until subscriber is ready
    await sleep(1500);

    await got.post(`http://localhost:43377/commit`, {
      body: {
        type: 'test-before-destroy',
        payload: {},
      },
      json: true,
    });

    // await for first persistence complete
    await sleep(200);

    // destroy server and all of its connections
    server1.destroy();

    // wait for retries
    await sleep(200);

    const server2 = await startServer({
      redis: 'redis://localhost:6379/6',
      port: 43377,
      namespc: 'client-e2e-test-retry',
    });

    await sleep(20);

    const resp = await got.post(`http://localhost:43377/commit`, {
      body: {
        type: 'test-reconnection',
        payload: {},
      },
      json: true,
    });

    const { stdout } = await subscriberPromise;
    server2.destroy();
    const appEvents = normalize(stdout.split('\n'));
    expect(appEvents.map(e => e.type)).toEqual([
      'load-config-begin',
      'load-config-end',
      'load-transform-begin',
      'load-transform-end',
      'connect-snapshot-begin',
      'connect-snapshot-end',
      'connect-events-begin',
      'connect-events-end',
      'subscription-catchup',
      'incoming-event',
      'incoming-projection',
      'persistence-complete',

      /* server1.destroy() */

      'err-server-disconnected',

      'await-retry', // retry after 10ms
      'connect-snapshot-begin',
      'connect-snapshot-end',
      'connect-events-begin', // takes 300ms to timeout
      'err-server-disconnected',

      'await-retry', // retry after 30ms
      'connect-snapshot-begin',
      'connect-snapshot-end',

      /* server2 connected at +200ms */

      'connect-events-begin', // current at +340ms
      'connect-events-end', // reconnected
      'incoming-event',
      'incoming-projection',
      'persistence-complete',
      'subscription-catchup',
      'process-interrupted',
      'process-exit',
    ]);

    expect(
      appEvents
        .filter(e => e.type === 'await-retry')
        .map(e => e.payload.retryAfter)
    ).toEqual([10, 30]);
  });

  test('side-effects', async () => {
    await db.dropDatabase();

    const server = await startServer({
      redis: 'redis://localhost:6379/6',
      port: 43388,
      namespc: 'client-e2e-test-side-effect',
      clean: true,
    });

    for (const event of seedingEvents) {
      await got.post(`http://localhost:43388/commit`, {
        body: event,
        json: true,
      });
    }

    const { stdout } = await subscribe({
      configPath: './fixtures/config/sideEffect.config.js',
      keepAlive: 2000,
    });

    server.destroy();

    const lines = stdout.split('\n');

    const appLogs = lines.filter(line => line[0] === '{');
    const sideEffectsLogs = lines.filter(line => line[0] !== '{');

    const appEvents = normalize(appLogs);

    expect(appEvents.map(e => e.type)).toEqual([
      'load-config-begin',
      'load-config-end',
      'load-transform-begin',
      'load-transform-end',
      'connect-snapshot-begin',
      'connect-snapshot-end',
      'connect-events-begin',
      'connect-events-end',
      'incoming-event',
      'incoming-projection',
      'incoming-event',
      'incoming-projection',
      'incoming-event',
      'incoming-projection',
      'incoming-event',
      'incoming-projection',
      'incoming-event',
      'incoming-projection',
      'incoming-event',
      'incoming-projection',
      'incoming-event',
      'incoming-projection',
      'incoming-event',
      'incoming-projection',
      'incoming-event',
      'incoming-projection',
      'persistence-complete',
      'subscription-catchup',
      'err-side-effect-failed', // this fails immediately
      'side-effects-complete', // batch of 3 side-effects-complete's
      'process-interrupted',
      'process-exit',
    ]);

    expect(
      appEvents.filter(e => e.type === 'err-side-effect-failed')[0].payload
        .error.message
    ).toBe('must fail');

    expect(sideEffectsLogs).toMatchSnapshot('sideEffectsLogs must match');
  });
});
