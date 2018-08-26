export const eventSelected = eventId => ({
  type: 'EVENT_SELECTED',
  payload: eventId,
});

const selectedEvent = (state = null, action) => {
  if (action.type === 'EVENT_SELECTED') {
    return action.payload;
  }

  return state;
};

export default {
  selectedEvent,
};
