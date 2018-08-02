const SAMPLE_EVENT = { type: 'TEST', payload: {} };

export const startCompose = () => ({
  type: 'DISPATCHER:COMPOSING_STARTED',
  payload: {
    body: SAMPLE_EVENT,
  },
});

export const closeDispatcher = () => ({
  type: 'DISPATCHER:CLOSED',
});

export const cloneEvent = event => ({
  type: 'DISPATCHER:COMPOSING_STARTED',
  payload: {
    id: event.id,
    type: event.type,
    payload: event.payload,
  },
});

export default {
  isDispatcherOpen: (state = false, action) => {
    if (action.type === 'DISPATCHER:COMPOSING_STARTED') {
      return true;
    }

    if (action.type === 'DISPATCHER:CLOSED') {
      return false;
    }

    return state;
  },

  dispatcherInitialEvent: (state = SAMPLE_EVENT, action) => {
    if (action.type === 'DISPATCHER:COMPOSING_STARTED') {
      return action.payload;
    }

    return state;
  },
};
