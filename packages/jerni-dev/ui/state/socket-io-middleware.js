const isServer = typeof window === "undefined";

export default store => {
  if (isServer) {
    return next => action => next(action);
  }

  const socket = io();
  socket.on("redux event", event => {
    store.dispatch(event);
  });

  return next => action => {
    if (action.type === "IO_EMIT") {
      socket.emit("client action", action.payload);
      return;
    }

    return next(action);
  };
};

export const socketEmit = event => ({
  type: "IO_EMIT",
  payload: event
});
