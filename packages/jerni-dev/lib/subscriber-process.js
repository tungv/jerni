const { serializeStream, deserializeStream } = require("./proxy-stream");

const importPathWithInterop = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

async function main(filepath) {
  // worker
  const store = await importPathWithInterop(filepath);
  process.on("message", async msg => {
    if (msg.cmd === "simple call") {
      const args = msg.args.map(
        arg => (arg && arg.$stream ? deserializeStream(process, arg) : arg)
      );
      const reply = await store[msg.methodName].apply(store, args);

      if (reply && typeof reply.observe === "function") {
        process.send({
          cmd: "simple call reply",
          id: msg.id,
          reply: serializeStream(process, msg.id, reply)
        });
      } else {
        process.send({ cmd: "simple call reply", id: msg.id, reply });
      }
    }
  });
}

main(process.argv[2]);
