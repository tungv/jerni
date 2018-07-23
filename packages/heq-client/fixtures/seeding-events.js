module.exports = [
  {
    type: 'DEPARTMENT_CREATED',
    payload: {
      id: 'c95803b4-b29c-40a9-923e-fc2225e001f8',
      name: 'marketing',
    },
    meta: {
      client: 'test-commiter-1',
      clientVersion: '1.0.0',
      occurredAt: 1505728418175,
    },
  },
  {
    type: 'USER_REGISTERED',
    payload: {
      uid: '9d5901c0-4228-4832-adb2-41cb3a8797cd',
      email: 'abc@events.com',
      name: 'ABC',
      age: 21,
      department_id: 'c95803b4-b29c-40a9-923e-fc2225e001f8',
    },
    meta: {
      client: 'test-commiter-1',
      clientVersion: '1.0.0',
      occurredAt: 1505728418175,
    },
  },
  {
    type: 'USER_REGISTERED',
    payload: {
      uid: '6d90bd42-62ef-4d3c-91aa-6f517fdcc8da',
      email: 'def@events.com',
      name: 'DEF',
      age: 23,
      department_id: 'c95803b4-b29c-40a9-923e-fc2225e001f8',
    },
    meta: {
      client: 'test-commiter-1',
      clientVersion: '1.0.0',
      occurredAt: 1505728521586,
    },
  },
  {
    type: 'DEPARTMENT_CREATED',
    payload: {
      id: 'f7a094c4-dd60-40c1-bcfd-1650b5a57cc8',
      name: 'IT',
    },
    meta: {
      client: 'test-commiter-1',
      clientVersion: '1.0.0',
      occurredAt: 1505728418175,
    },
  },
  {
    type: 'USER_EMAIL_UPDATED',
    payload: {
      uid: '9d5901c0-4228-4832-adb2-41cb3a8797cd',
      email: 'newemail@events.com',
    },
    meta: {
      client: 'test-commiter-1',
      clientVersion: '1.0.0',
      occurredAt: 1505728523586,
    },
  },
  {
    type: 'USER_REGISTERED',
    payload: {
      uid: '3822c08a-2967-40bb-8c99-d3c76b569561',
      email: 'ghi@events.com',
      name: 'GHI',
      age: 27,
      department_id: 'f7a094c4-dd60-40c1-bcfd-1650b5a57cc8',
    },
    meta: {
      client: 'test-commiter-1',
      clientVersion: '1.0.0',
      occurredAt: 1505728528648,
    },
  },

  {
    type: 'USER_EMAIL_UPDATED',
    payload: {
      uid: '9d5901c0-4228-4832-adb2-41cb3a8797cd',
      email: 'updated',
    },
  },
  {
    type: 'USER_EMAIL_UPDATED',
    payload: {
      uid: '9d5901c0-4228-4832-adb2-41cb3a8797cd',
      email: 'failing',
    },
  },
  {
    type: 'USER_EMAIL_UPDATED',
    payload: {
      uid: '9d5901c0-4228-4832-adb2-41cb3a8797cd',
      email: 'updated',
    },
  },
];
