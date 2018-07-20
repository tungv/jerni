const test = require('ava');
const { start } = require('./utils');

test('should start normally', async t => {
  const output = await start();

  t.true(output.includes('8080'), 'must include INFO log');
  t.true(output.includes('terminating'), 'must include terminating at the end');
});

test('should start with less than 300ms', async t => {
  const startTime = Date.now();
  const output = await start({ args: ['--port=8081'], timeoutMs: 0 });
  t.true(Date.now() - startTime < 300);
});
