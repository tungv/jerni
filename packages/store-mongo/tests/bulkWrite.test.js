const bulkWrite = require('../lib/bulkWrite');

const test = require('ava');

const stubDB = () => {
  const collectionCalls = [];
  const bulkWriteCalls = [];

  return {
    collection(name) {
      collectionCalls.push(name);

      return {
        bulkWrite(ops) {
          bulkWriteCalls.push({ name, ops });
          return ops;
        },
      };
    },

    calls() {
      return {
        collectionCalls,
        bulkWriteCalls,
      };
    },
  };
};

test('bulkWrite should call db.collection', async t => {
  const db = stubDB();
  const commands = [
    {
      collection: 'col_1',
      ops: [{ insertOne: { k: 1 }, updateOne: { k: 2 } }],
    },
    {
      collection: 'col_2',
      ops: [{ insertOne: { k: 3 }, updateOne: { k: 4 } }],
    },
    {
      collection: 'col_1',
      ops: [{ insertOne: { k: 5 }, updateOne: { k: 6 } }],
    },
    {
      collection: 'col_3',
      ops: [{ insertOne: { k: 7 }, updateOne: { k: 8 } }],
    },
    {
      collection: 'col_3',
      ops: [{ insertOne: { k: 9 }, updateOne: { k: 10 } }],
    },
  ];

  const writeResults = await bulkWrite(db, commands);
  const calls = db.calls();
  t.deepEqual(calls.collectionCalls, ['col_1', 'col_2', 'col_3']);
  t.deepEqual(calls.bulkWriteCalls, [
    {
      name: 'col_1',
      ops: [
        { insertOne: { k: 1 }, updateOne: { k: 2 } },
        { insertOne: { k: 5 }, updateOne: { k: 6 } },
      ],
    },
    {
      name: 'col_2',
      ops: [{ insertOne: { k: 3 }, updateOne: { k: 4 } }],
    },
    {
      name: 'col_3',
      ops: [
        { insertOne: { k: 7 }, updateOne: { k: 8 } },
        { insertOne: { k: 9 }, updateOne: { k: 10 } },
      ],
    },
  ]);
});
