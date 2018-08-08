const kefir = require('kefir');
const test = require('ava');

const transform = require('../lib/transform');

const childrenBorn = () => ({
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
});

test('transform', t => {
  const ops = transform(sampleChildrenBornEventHandler, childrenBorn());
  t.snapshot(ops);
});

test('transform: updateMany', t => {
  const ops = transform(
    event => [
      {
        updateMany: {
          where: { x: 2 },
          changes: {
            $set: { x: 1 },
            $inc: { y: 1 },
          },
        },
      },
    ],
    { id: 2, type: 'test' }
  );

  t.deepEqual(ops, [
    {
      updateMany: {
        filter: {
          $and: [
            { x: 2 },
            {
              $or: [{ __v: { $lt: 2 } }, { __v: 2, __op: { $lt: 0 } }],
            },
          ],
        },
        update: {
          $set: {
            __v: 2,
            __op: 0,
            x: 1,
          },
          $inc: { y: 1 },
        },
        upsert: false,
      },
    },
  ]);
});

test('transform: insertMany', t => {
  const ops = transform(
    event => [
      {
        insertMany: [
          { id: 1, name: 'doc_1' },
          { id: 2, name: 'doc_2' },
          { id: 3, name: 'doc_3' },
        ],
      },
    ],
    { id: 2, type: 'test' }
  );

  t.deepEqual(ops, [
    {
      updateOne: {
        filter: { $or: [{ __v: { $gt: 2 } }, { __v: 2, __op: { $gt: 0 } }] },
        update: { $setOnInsert: { id: 1, name: 'doc_1', __v: 2, __op: 0 } },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { $or: [{ __v: { $gt: 2 } }, { __v: 2, __op: { $gt: 1 } }] },
        update: { $setOnInsert: { id: 2, name: 'doc_2', __v: 2, __op: 1 } },
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { $or: [{ __v: { $gt: 2 } }, { __v: 2, __op: { $gt: 2 } }] },
        update: { $setOnInsert: { id: 3, name: 'doc_3', __v: 2, __op: 2 } },
        upsert: true,
      },
    },
  ]);
});

test('transform: insertOne', t => {
  const ops = transform(
    event => [
      {
        insertOne: { id: 1, name: 'doc_1' },
      },
    ],
    { id: 2, type: 'test' }
  );

  t.deepEqual(ops, [
    {
      updateOne: {
        filter: { $or: [{ __v: { $gt: 2 } }, { __v: 2, __op: { $gt: 0 } }] },
        update: { $setOnInsert: { id: 1, name: 'doc_1', __v: 2, __op: 0 } },
        upsert: true,
      },
    },
  ]);
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
