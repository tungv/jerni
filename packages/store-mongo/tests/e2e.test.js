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
    [{ id: 7, type: 'TEST_5' }],
  ];
  const stream = makeStream(incomingBatchedEvents);

  const model = new Model({
    name: 'collection_1',
    version: 'e2e',
    transform: event =>
      [
        { insertOne: { event_type: event.type, counter: 0 } },
        event.type === 'TEST_4' && {
          insertMany: [
            {
              y: 1,
            },
            {
              y: 2,
            },
            {
              y: 3,
            },
            {
              y: 4,
            },
          ],
        },
        {
          updateOne: {
            where: {
              event_type: 'TEST_1',
            },
            change: {
              $inc: { counter: 1 },
            },
          },
        },
        {
          updateMany: {
            where: {
              counter: { $gte: 2 },
            },
            changes: {
              $addToSet: {
                array: { unique: event.id },
              },
            },
          },
        },
        event.type === 'TEST_4' && {
          deleteOne: {
            where: {
              event_type: 'TEST_3',
            },
          },
        },
        event.type === 'TEST_5' && {
          deleteMany: {
            where: {
              y: { $gte: 3 },
            },
          },
        },
      ].filter(x => x),
  });

  const conn = new Connection({
    url: 'mongodb://localhost:27017',
    dbName: 'test_e2e',
    models: [model],
  });

  let subscription;

  conn.subscribe(async id => {
    if (id === 7) {
      const coll = await conn.getDriver(model);

      const items = await coll.find({}).toArray();
      console.log(items.map(({ _id, ...item }) => item));
      t.deepEqual(items.map(({ _id, ...item }) => item), [
        {
          __op: 3,
          __v: 7,
          counter: 7,
          event_type: 'TEST_1',
          array: [
            { unique: 2 },
            { unique: 3 },
            { unique: 4 },
            { unique: 5 },
            { unique: 6 },
            { unique: 7 },
          ],
        },
        { __op: 0, __v: 2, counter: 0, event_type: 'TEST_2' },
        { __op: 0, __v: 4, counter: 0, event_type: 'TEST_1' },
        { __op: 0, __v: 5, counter: 0, event_type: 'TEST_3' },
        { __op: 0, __v: 6, counter: 0, event_type: 'TEST_4' },
        { __op: 1, __v: 6, y: 1 },
        { __op: 2, __v: 6, y: 2 },
        { __op: 0, __v: 7, counter: 0, event_type: 'TEST_5' },
      ]);
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
      conn.receive(stream).then(outputStream => {
        subscription = outputStream.observe();
      });
    });
});
