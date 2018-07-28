const reducer = (state = { events: [] }, action) => {
  switch (action.type) {
    case 'SERVER:INCOMING_EVENTS':
      return {
        ...state,
        events: [...action.payload.reverse(), ...state.events],
      };

    default:
      return state;
  }
};

export default reducer;
