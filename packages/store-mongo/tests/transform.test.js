const kefir = require('kefir');
const test = require('ava');

const transform = require('../lib/transform');

test('transform', t => {
  const event = {
    id: 10,
    type: 'CHILDREN_BORN',
    payload: {
      children: [
        {
          id: '11',
          name: 'child_1',
        },
        {
          id: '12',
          name: 'child_2',
        },
        {
          id: '13',
          name: 'child_3',
        },
      ],
      parents: ['1', '2'],
    },
    meta: {
      occurred_at: 1533632235302,
    },
  };

  const ops = transform(sampleChildrenBornEventHandler, event);

  t.snapshot(ops);
});

const sampleChildrenBornEventHandler = event => {
  if (event.type === 'CHILDREN_BORN') {
    const {
      payload: { children, parents },
      meta,
    } = event;
    return [
      {
        insertMany: children.map(child => ({
          id: child.id,
          full_name: child.name,
          born_at: meta.occurred_at,
        })),
      },
      {
        updateMany: {
          where: { id: { $in: [parents] } },
          changes: {
            $push: {
              children: {
                $each: children.map(child => child.id),
              },
            },
          },
        },
      },
    ];
  }

  return [];
};

const Model = require('../lib/MongoDBReadModel');
const Connection = require('../lib/MongoDBConnection');

const makeStream = array => kefir.sequentially(10, array);

test.cb('transform', t => {
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
