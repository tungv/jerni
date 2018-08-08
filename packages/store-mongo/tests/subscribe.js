const kefir = require('kefir');
const test = require('ava');

const Model = require('../lib/MongoDBReadModel');
const Connection = require('../lib/MongoDBConnection');

const makeStream = array => kefir.sequentially(10, array);

test.cb('subscribe', t => {
  const incomingBatchedEvents = [
    [{ id: 1 }, { id: 2 }],
    [{ id: 3 }, { id: 4 }],
    [{ id: 5 }, { id: 6 }],
  ];
  const stream = makeStream(incomingBatchedEvents);

  const model1 = new Model({
    name: 'collection_1',
    version: 'abc',
    transform: event => [{ insertOne: { x: 1 } }],
  });

  const model2 = new Model({
    name: 'collection_2',
    version: '1.2.3',
    transform: event => [{ insertOne: { x: 2 } }],
  });

  const conn = new Connection({
    url: 'mongodb://localhost:27017',
    dbName: 'test_transform',
    models: [model1, model2],
  });

  conn.subscribe(id => {
    if (id === 6) {
      t.end();
    }
  });

  conn.clean().then(() => {
    conn.receive(stream);
  });
});
