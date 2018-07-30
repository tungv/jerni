export const eventsReceived = events => ({
  type: 'SERVER:INCOMING_EVENTS',
  payload: {
    events,
    receivedAt: Date.now(),
  },
});

const events = (state = [], action) => {
  switch (action.type) {
    case 'SERVER:INCOMING_EVENTS':
      return [...state, ...action.payload.events];

    default:
      return state;
  }
};

const lastReceivedAt = (state = null, action) => {
  switch (action.type) {
    case 'SERVER:INCOMING_EVENTS':
      return action.payload.receivedAt;

    default:
      return state;
  }
};

export default {
  events,
  lastReceivedAt,
};
