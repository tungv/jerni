const { watch } = require("chokidar");
const brighten = require("brighten");
const debounce = require("debounce");
const colors = require("ansi-colors");
const pkgDir = require("pkg-dir");

const path = require("path");

const { serializeStream, deserializeStream } = require("./proxy-stream");
const { wrapError } = require("./wrapError");

const importPathWithInterop = async filepath => {
  try {
    const mod = await require(filepath);
    return mod.default || mod;
  } catch (ex) {
    throw wrapError(ex);
  }
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

  watcher.on(
    "change",
    debounce(filePath => {
      const location = path.relative(process.cwd(), filePath);
      brighten();
      console.log(
        `\n${colors.bgYellow.bold(" File changed ")} ${colors.underline(
          location
        )} - Replaying...`
      );

      process.send({
        cmd: "reload"
      });
    }, 300)
  );
}

main(process.argv[2]).then(
  () => {
    process.send({ cmd: "ok" });
  },
  ex => {
    process.send({
      cmd: "error",
      name: ex.name,
      message: ex.message,
      location: ex.location
    });
    process.exit(1);
  }
);
