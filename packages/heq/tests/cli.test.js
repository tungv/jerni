const test = require("ava");
const { start } = require("./utils");

test("should start normally", async t => {
  const output = await start();

  t.true(output.includes("8080"), "must include port in INFO log");
  t.true(
    output.includes("local - redis://localhost:6379"),
    "must include redis in INFO log",
  );
  t.true(output.includes("terminating"), "must include terminating at the end");
});

test("should start with less than 300ms", async t => {
  const startTime = Date.now();
  const output = await start({ args: ["--port=8081"], timeoutMs: 0 });
  t.true(Date.now() - startTime < 300);
});

test("should report if redis cannot be connected", async t => {
  const error = await t.throws(
    start({
      args: ["--port=8082", "--redis=redis://localhost:9999"],
    }),
  );

  t.true(error.message.includes("Redis connection to localhost:9999 failed"));
});

// skip this because it's hard to reproduce on local machine
test.skip("should report if port cannot be opened", async t => {
  const error = await t.throws(
    start({
      args: ["--port=1"],
    }),
  );

  t.true(error.message.includes("Error: listen EACCES"));
});
test("should report if port is occupied", async t => {
  const dummyServer = require("http").createServer((req, res) => {
    res.end("OK");
  });

  try {
    dummyServer.listen(32891);
  } catch (ex) {}
  const error = await t.throws(
    start({
      args: ["--port=32891"],
    }),
  );

  dummyServer.close();

  t.true(error.message.includes("Error: listen EADDRINUSE"));
});

test("should pickup env variables HEQ_*", async t => {
  process.env.HEQ_PORT = "8083";
  process.env.HEQ_REDIS_NAMESPACE = "test-env";
  process.env.HEQ_REDIS_URL = "redis://localhost:6379/1";
  const output = await start();

  t.true(output.includes("8083"), "must include port INFO log");
  t.true(
    output.includes("test-env - redis://localhost:6379/1"),
    "must include redis in INFO log",
  );
});
