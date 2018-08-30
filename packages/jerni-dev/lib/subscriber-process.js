const { serializeStream, deserializeStream } = require("./proxy-stream");
const pkgDir = require("pkg-dir");
const kleur = require("kleur");
const brighten = require("brighten");
const { watch } = require("chokidar");
const path = require("path");

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

  const watcher = watch(toWatch, {
    ignored: [
      /\.git|node_modules|\.nyc_output|\.sass-cache|coverage|\.cache/,
      /\.swp$/
    ]
  });

  watcher.on("change", filePath => {
    const location = path.relative(process.cwd(), filePath);
    brighten();
    console.log(
      `\n${kleur.bgYellow.bold(" File changed ")} ${kleur.underline(
        location
      )} - Replaying...`
    );

    process.send({
      cmd: "reload"
    });
  });
}

main(process.argv[2]).then(
  () => {
    console.log("new worker is ready");
    process.send({ cmd: "ok" });
  },
  ex => {
    process.send({ cmd: "error", name: ex.name, message: ex.message });
    process.exit(1);
  }
);
