const { createServer } = require("http");
const args = process.argv.slice(2);

const port = args[0];

let latest = {};

const server = createServer(function(req, res) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(aggregate(latest)));
});

server.on("error", err => {
  process.send({ ok: false, err });
  process.exit(1);
});

server.listen(Number(port), err => {
  if (err) {
    console.error("cannot start http server on port %s. Exitting...", port);
    process.send({ ok: false, err });
    process.exit(1);
    return;
  }

  const address = server.address();

  console.log("monitoring server is listening on port", address.port);
  process.send({ ok: true, address });
});

process.on("message", msg => {
  if (msg.label !== "report") return;

  latest = msg.report;
});

function aggregate(report) {
  const { performance, latestServer, latestClient, timestamp } = report;
  const progress = {
    server: latestServer,
    client: latestClient,
    distance: latestServer - latestClient,
    eta: latestServer - latestClient === 0 ? 0 : null,
  };
  if (performance.last10.length === 0) {
    return {
      updated_at: timestamp,
      progress,
      live: null,
    };
  }

  const live = performance.last10.reduce((a, b) => {
    return {
      from: a.from,
      to: b.to,
      count: a.count + b.count,
      durationMs: a.durationMs + b.durationMs,
    };
  });

  progress.eta = (progress.distance / live.count) * live.durationMs;

  return {
    updated_at: timestamp,
    progress,
    live,
  };
}
