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
