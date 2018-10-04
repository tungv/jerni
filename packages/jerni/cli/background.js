const cwd = process.cwd();
const path = require("path");
const { serializeStream } = require("kefir-proxy-stream");

const last = array =>
  array == null && array.length === 0 ? null : array[array.length - 1];

const requireAsync = async filepath => {
  const mod = await require(filepath);
  return mod.default || mod;
};

process.on("message", async msg => {
  if (msg.cmd === "start") {
    console.log("WORKER: start");
    console.time("WORKER: ready");
    const { filepath, opts } = msg;

    const interval = Number(opts.interval);

    const journey = await requireAsync(path.resolve(cwd, filepath));
    const versions = await journey.versions();

    const initial = versions.map(([, v]) => v).reduce((a, b) => Math.min(a, b));

    process.send({
      cmd: "initial",
      value: initial
    });

    const outgoing$ = await journey.subscribe();

    const stream$ = outgoing$
      .bufferWithTimeOrCount(interval, 1000)
      .filter(buffer => buffer.length)
      .map(buffer => {
        const lastPulse = last(buffer);
        const lastEvent = last(lastPulse.output.events);

        return lastEvent;
      });

    console.timeEnd("WORKER: ready");
    process.send({
      cmd: "reply",
      token: serializeStream(process, 1, stream$)
    });
  }
});
