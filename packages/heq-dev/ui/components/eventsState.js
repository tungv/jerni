export const markAsRemoving = id => ({
  type: "REMOVING_LIST_APPENDED",
  payload: id
});

export const unmarkAsRemoving = id => ({
  type: "REMOVING_LIST_REMOVED",
  payload: id
});

export const clearRemovingList = () => ({
  type: "REMOVING_LIST_CLEARED"
});

export const isEventRemovingSelector = (state, id) =>
  state.removingEventIds.includes(id);

export const removingEventCount = (state, idArray) =>
  state.removingEventIds.filter(id => idArray.includes(id)).length;

const removingEventIds = (state = [], { type, payload }) => {
  if (type === "REMOVING_LIST_APPENDED" && state.includes(payload) === false) {
    return [...state, payload];
  }

  if (type === "REMOVING_LIST_REMOVED" && state.includes(payload) === true) {
    return state.filter(id => id !== payload);
  }

  if (type === "REMOVING_LIST_CLEARED" || type === "PULSES_INITIALIZED") {
    return [];
  }

  return state;
};

export default { removingEventIds };
