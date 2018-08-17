export default [
  {
    events: [
      {
        type: 'PERSON_DEREGISTERED',
        payload: { id: '1' },
        meta: {
          occurredAt: 1534391573509,
          client: 'heq-dev',
          clientVersion: 'alpha',
        },
        id: 8,
      },
    ],
    models: [
      {
        model: { name: 'people', version: '1.0.0' },
        added: 0,
        modified: 4,
        removed: 1,
      },
    ],
  },
  {
    events: [
      {
        type: 'PERSON_REGISTERED',
        payload: { id: '8', name: 'taa', born_at: 123412312 },
        meta: {
          occurredAt: 1534391549872,
          client: 'heq-dev',
          clientVersion: 'alpha',
        },
        id: 7,
      },
    ],
    models: [
      {
        model: { name: 'people', version: '1.0.0' },
        added: 1,
        modified: 0,
        removed: 0,
      },
    ],
  },
  {
    events: [
      {
        type: 'TEST',
        payload: {},
        meta: {
          occurredAt: 1534391519408,
          client: 'heq-dev',
          clientVersion: 'alpha',
        },
        id: 6,
      },
    ],
    models: [
      {
        model: { name: 'people', version: '1.0.0' },
        added: 0,
        modified: 0,
        removed: 0,
      },
    ],
  },
  {
    events: [
      {
        type: 'PERSON_REGISTERED',
        payload: { id: '1', name: 't', born_at: 123412312 },
        meta: {
          occurredAt: 1534389712188,
          client: 'heq-dev',
          clientVersion: 'alpha',
        },
        id: 1,
      },
      {
        type: 'PERSON_REGISTERED',
        payload: { id: '2', name: 'tr', born_at: 123412312 },
        meta: {
          occurredAt: 1534389720039,
          client: 'heq-dev',
          clientVersion: 'alpha',
        },
        id: 2,
      },
      {
        type: 'CHILDREN_BORN',
        payload: { children: [{ id: '3', name: 'b' }], parents: ['1', '2'] },
        meta: {
          occurredAt: 1534389749479,
          client: 'heq-dev',
          clientVersion: 'alpha',
        },
        id: 3,
      },
      {
        type: 'CHILDREN_BORN',
        payload: {
          children: [{ id: '4', name: 'k' }, { id: '5', name: 'tes' }],
          parents: ['1', '2'],
        },
        meta: {
          occurredAt: 1534389793210,
          client: 'heq-dev',
          clientVersion: 'alpha',
        },
        id: 4,
      },
      {
        type: 'CHILDREN_BORN',
        payload: {
          children: [{ id: '6', name: 'k' }, { id: '7', name: 'tes' }],
          parents: ['1', '2'],
        },
        meta: {
          occurredAt: 1534390139311,
          client: 'heq-dev',
          clientVersion: 'alpha',
        },
        id: 5,
      },
    ],
    models: [
      {
        model: { name: 'people', version: '1.0.0' },
        added: 7,
        modified: 6,
        removed: 0,
      },
    ],
  },
];
