const kefir = require('kefir');
const test = require('ava');

const Model = require('../lib/MongoDBReadModel');
const Connection = require('../lib/MongoDBConnection');

const makeStream = array => kefir.sequentially(10, array);

test.cb('e2e', t => {
  const incomingBatchedEvents = [
    [{ id: 1, type: 'TEST_1' }],
    [
      { id: 2, type: 'TEST_2' },
      { id: 3, type: 'TEST_3' },
      { id: 4, type: 'TEST_1' },
    ],
    [{ id: 5, type: 'TEST_3' }, { id: 6, type: 'TEST_4' }],
  ];
  const stream = makeStream(incomingBatchedEvents);

  const model = new Model({
    name: 'collection_1',
    version: 'e2e',
    transform: event => [
      { insertOne: { x: event.type, counter: 0 } },
      {
        insertMany: [
          {
            y: 1,
            number: Math.random(),
          },
          {
            y: 2,
            number: Math.random(),
          },
          {
            y: 3,
            number: Math.random(),
          },
        ],
      },
      // {
      //   updateOne: {
      //     where: {
      //       x: 'TEST_1',
      //     },
      //     change: {
      //       $inc: { counter: 1 },
      //     },
      //   },
      // },
      // {
      //   updateMany: {
      //     where: {
      //       y: { $gte: 2 },
      //     },
      //     changes: {
      //       $set: {
      //         number: -1,
      //       },
      //     },
      //   },
      // },
    ],
  });

  const conn = new Connection({
    url: 'mongodb://localhost:27017',
    dbName: 'test_e2e',
    models: [model],
  });

  let subscription;

  conn.subscribe(async id => {
    if (id === 6) {
      const coll = await conn.getDriver(model);

      const items = await coll.find({}).toArray();
      t.is(items.length, 24);
      // console.log(items.map(({ id, ...item }) => item));
      t.end();
      subscription.unsubscribe();
    }
  });

  conn
    .clean()
    .then(() => conn.getDriver(model))
    .then(coll => coll.countDocuments({}))
    .then(count => {
      t.is(count, 0);
      conn.receive(stream).then(sub => (subscription = sub));
    });
});
