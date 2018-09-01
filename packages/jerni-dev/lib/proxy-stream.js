const kefir = require("kefir");
const serializeStream = (sender, id, incoming$) => {
  if (!incoming$) {
    return;
  }
  const token = {
    $stream: id
  };

  const sub = incoming$.observe(
    data => {
      sender.send({
        id,
        cmd: "incoming data",
        data
      });
    },
    err => {},
    () => {
      sender.send({
        id,
        cmd: "incoming end"
      });
    }
  );

  sender.on("disconnect", () => {
    sub.unsubscribe();
  });

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

    receiver.on("message", handler);

    receiver.on("disconnect", () => {
      emitter.end();
    });

    return () => {
      receiver.removeListener("message", handler);
    };
  });
};

exports.serializeStream = serializeStream;
exports.deserializeStream = deserializeStream;
