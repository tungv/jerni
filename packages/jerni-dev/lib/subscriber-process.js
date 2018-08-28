const { serializeStream, deserializeStream } = require("./proxy-stream");
const pkgDir = require("pkg-dir");

const importPathWithInterop = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

async function main(filepath) {
  // worker
  const store = await importPathWithInterop(filepath);

  process.on("message", async msg => {
    if (msg.cmd === "simple call") {
      console.log("worker:: executing %s", msg.methodName);
      const args = msg.args.map(
        arg => (arg && arg.$stream ? deserializeStream(process, arg) : arg)
      );
      const reply = await store[msg.methodName].apply(store, args);

      console.log("worker:: executed %s", msg.methodName);

      if (reply && typeof reply.observe === "function") {
        process.send({
          cmd: "simple call reply",
          id: msg.id,
          methodName: msg.methodName,
          reply: serializeStream(process, msg.id, reply)
        });
      } else {
        process.send({
          cmd: "simple call reply",
          id: msg.id,
          reply,
          methodName: msg.methodName
        });
      }
    }
  });

  const rootDir = pkgDir.sync(filepath);
  const toWatch = Object.keys(require.cache).filter(f => f.startsWith(rootDir));

  console.log({ toWatch: toWatch.map(f => f.split(rootDir).join(".")) });
}

main(process.argv[2]);
