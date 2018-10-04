const kefir = require("kefir");
const serializeStream = (sender, id, incoming$) => {
  if (!incoming$) {
    return;
  }
  const token = {
    $stream: id
  };

  const onData = data =>
    sender.send({
      id,
      cmd: "incoming data",
      data
    });

  const onEnd = () => {
    sub.unsubscribe();
  };
  const onUnsubscribe = msg => {
    if (msg.id !== id || msg.cmd !== "stream unsubscribe") {
      return;
    }

    cleanSender();
  };

  const cleanSender = () => {
    sender.removeListener("disconnect", onEnd);
    sender.removeListener("message", onUnsubscribe);
  };

  const cleanReceiver = () => {
    sender.send({
      id,
      cmd: "incoming end"
    });
  };

  const sub = incoming$.observe(
    onData,
    err => {},
    () => {
      cleanReceiver();
      cleanSender();
    }
  );

  sender.on("message", onUnsubscribe);
  sender.once("disconnect", onEnd);

  return token;
};

const deserializeStream = (receiver, token) => {
  const id = token.$stream;
  return kefir.stream(emitter => {
    const handler = msg => {
      if (msg.id !== id) {
        return;
      }
      if (msg.cmd === "incoming data") {
        emitter.emit(msg.data);
      }
      if (msg.cmd === "incoming end") {
        emitter.end();
      }
    };

    const onEnd = () => {
      emitter.end();
    };

    receiver.on("message", handler);
    receiver.once("disconnect", onEnd);

    return () => {
      receiver.send({
        cmd: "stream unsubscribe",
        id
      });
      receiver.removeListener("message", handler);
      receiver.removeListener("disconnect", onEnd);
    };
  });
};

exports.serializeStream = serializeStream;
exports.deserializeStream = deserializeStream;
