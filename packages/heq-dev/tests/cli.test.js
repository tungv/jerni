const test = require('ava');
const { start } = require('./utils');

test('should start normally', async t => {
  const output = await start();

  t.true(output.includes('8080'), 'must include port in INFO log');
  t.true(
    output.includes('local') && output.includes('@heq/server-lokijs'),
    'must include lokijs in INFO log'
  );
  t.true(output.includes('terminating'), 'must include terminating at the end');
});

test('should start with less than 300ms', async t => {
  const startTime = Date.now();
  const output = await start({ args: ['--port=8081'], timeoutMs: 0 });
  t.true(Date.now() - startTime < 300);
});

test('should report if port cannot be opened', async t => {
  const error = await t.throws(
    start({
      args: ['--port=80'],
    })
  );

  t.true(error.message.includes('Error: listen EACCES 0.0.0.0:80'));
});

test('should pickup env variables HEQ_*', async t => {
  process.env.HEQ_PORT = '8083';
  process.env.HEQ_LOKIJS_NAMESPACE = 'test-env';
  const output = await start();

  t.true(output.includes('8083'), 'must include port INFO log');
  t.true(output.includes('test-env'), 'must include loki in INFO log');
});
