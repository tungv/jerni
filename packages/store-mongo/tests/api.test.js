const is = require('@sindresorhus/is');
const test = require('ava');

const Connection = require('../lib/MongoDBConnection');

test('Connection should implement base class', t => {
  const { prototype } = Connection;

  t.true(is.function(prototype.getDriver));
  t.true(is.function(prototype.subscribe));
  t.true(is.asyncFunction(prototype.receive));

  const latestEventIdGetter = Object.getOwnPropertyDescriptor(
    prototype,
    'latestEventId'
  ).get;

  t.true(is.function(latestEventIdGetter));
});
