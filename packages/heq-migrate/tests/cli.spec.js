const execa = require("execa");
const path = require("path");
const fs = require("fs");
const makeServer = require("./makeServer");

function rm(filepath) {
  if (!fs.existsSync(filepath)) return;

  fs.unlinkSync(filepath);
}

test("cli: only required arguments", async () => {
  const progressFile = path.resolve(
    process.cwd(),
    "./heq-migrate-progress.json",
  );

  rm(progressFile);

  const { queue: src, server: srv1 } = await makeServer({ port: 19989 });
  const { queue: dest, server: srv2 } = await makeServer({ port: 19988 });

  try {
    for (let i = 0; i < 10; ++i) {
      await src.commit({
        type: "type_" + ((i + 1) % 10),
        payload: { key: i },
      });
    }

    const instance = execa("node", [
      "./cli",
      "migrate",
      "http://localhost:19989",
      "http://localhost:19988",
    ]);

    const resp = await instance;
    expect(resp.exitCode).toBe(0);

    const results = await dest.query({ from: 0 });
    expect(results).toHaveLength(10);

    const content = require(progressFile);
    expect(content).toEqual({
      srcId: 10,
      destId: 10,
    });
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});

test("cli: with non-existent transform file", async () => {
  const progressFile = path.resolve(
    process.cwd(),
    "./heq-migrate-progress.json",
  );
  rm(progressFile);

  const { queue: src, server: srv1 } = await makeServer({ port: 19989 });
  const { queue: dest, server: srv2 } = await makeServer({ port: 19988 });

  try {
    for (let i = 0; i < 10; ++i) {
      await src.commit({
        type: "type_" + ((i + 1) % 10),
        payload: { key: i },
      });
    }

    const instance = execa("node", [
      "./cli",
      "migrate",
      "http://localhost:19989",
      "http://localhost:19988",
      "--transform=./tests/fixtures/non-existent.js",
    ]);

    // instance.stdout.pipe(process.stdout);
    // instance.stderr.pipe(process.stderr);

    await expect(instance).rejects.toEqual(
      expect.objectContaining({
        exitCode: 1,
        stderr: expect.stringContaining("Cannot find module"),
      }),
    );

    const results = await dest.query({ from: 0 });
    expect(results).toHaveLength(0);
    expect(!fs.existsSync(progressFile));
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});

test("cli: with transform file", async () => {
  const progressFile = path.resolve(
    process.cwd(),
    "./heq-migrate-progress.json",
  );
  rm(progressFile);
  const { queue: src, server: srv1 } = await makeServer({ port: 19989 });
  const { queue: dest, server: srv2 } = await makeServer({ port: 19988 });

  try {
    for (let i = 0; i < 10; ++i) {
      await src.commit({
        type: "type_" + ((i + 1) % 10),
        payload: { key: i },
      });
    }

    const instance = execa("node", [
      "./cli",
      "migrate",
      "http://localhost:19989",
      "http://localhost:19988",
      "--transform=./tests/fixtures/simple.js",
    ]);

    // instance.stdout.pipe(process.stdout);
    // instance.stderr.pipe(process.stderr);

    const resp = await instance;
    expect(resp.exitCode).toBe(0);

    const results = await dest.query({ from: 0 });
    expect(results).toHaveLength(8);

    const content = require(progressFile);
    expect(content).toEqual({
      srcId: 10,
      destId: 10,
    });
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});
