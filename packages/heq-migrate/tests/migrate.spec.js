const migrate = require("../src/migrate");
const makeServer = require("./makeServer");
const makeTestLogger = require("./makeTestLogger");

test("it should migrate everything if no configuration specified", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { server: srv1, queue: src } = await makeServer({ port: 19999 });
  const { server: srv2, queue: dest } = await makeServer({ port: 19998 });

  try {
    for (let i = 0; i < 20; ++i) {
      await src.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    const progress = {};

    for await (const output of migrate(
      "http://localhost:19999",
      "http://localhost:19998",
      { logger, progress },
    )) {
      logger.info(output);
    }
    const results = await dest.query({ from: 0 });

    expect(results).toHaveLength(20);

    expect(progress).toEqual({
      srcId: 20,
      destId: 20,
    });

    expect(results).toMatchSnapshot("replicate everything");
    expect(logs).toMatchSnapshot("DEBUG level logs");
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});

test("it should skip events specified in transform function", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { server: srv1, queue: src } = await makeServer({ port: 19999 });
  const { server: srv2, queue: dest } = await makeServer({ port: 19998 });
  const progress = {};
  try {
    for (let i = 0; i < 20; ++i) {
      await src.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    for await (const output of migrate(
      "http://localhost:19999",
      "http://localhost:19998",
      {
        progress,
        logger,
        transform(event) {
          if (event.type === "type_2" || event.type === "type_4") return false;

          return true;
        },
      },
    )) {
      logger.info(output);
    }
    const results = await dest.query({ from: 0 });

    expect(progress).toEqual({
      srcId: 20,
      destId: 16,
    });

    expect(results).toHaveLength(16);

    expect(results).toMatchSnapshot("should skip type_2 and type_4");
    expect(logs).toMatchSnapshot("DEBUG level logs");
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});

test("it should correct mark progress in case of error while skipping events", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { server: srv1, queue: src } = await makeServer({ port: 19999 });
  const { server: srv2, queue: dest } = await makeServer({ port: 19998 });
  const progress = {};
  try {
    for (let i = 0; i < 20; ++i) {
      await src.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    for await (const output of migrate(
      "http://localhost:19999",
      "http://localhost:19998",
      {
        progress,
        logger,
        transform(event) {
          if (event.type === "type_2" || event.type === "type_4") return false;
          if (event.type === "type_5") {
            throw new Error("failed for some reason");
          }
          return true;
        },
      },
    )) {
      logger.info(output);
    }
    const results = await dest.query({ from: 0 });

    expect(progress).toEqual({
      srcId: 4,
      destId: 3,
    });

    expect(results).toHaveLength(3);

    expect(results).toMatchSnapshot(
      "should skip type_2 and type_4 while terminated at type_5",
    );
    expect(logs).toMatchSnapshot("DEBUG level logs");
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});

test("it should modify events specified in transform function", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { server: srv1, queue: src } = await makeServer({ port: 19999 });
  const { server: srv2, queue: dest } = await makeServer({ port: 19998 });
  const progress = {};

  try {
    for (let i = 0; i < 20; ++i) {
      await src.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    for await (const output of migrate(
      "http://localhost:19999",
      "http://localhost:19998",
      {
        logger,
        progress,
        transform(event) {
          if (event.type === "type_2" || event.type === "type_4") {
            event.type = "modified";
            event.payload = { everything: "can change" };
          }

          return true;
        },
      },
    )) {
      logger.info(output);
    }
    const results = await dest.query({ from: 0 });

    expect(results).toHaveLength(20);
    expect(progress).toEqual({
      srcId: 20,
      destId: 20,
    });

    expect(results).toMatchSnapshot("modify type_2 and type_4 to modified");
    expect(logs).toMatchSnapshot("DEBUG level logs");
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});

test("it should replace events specified in transform function", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { server: srv1, queue: src } = await makeServer({ port: 19999 });
  const { server: srv2, queue: dest } = await makeServer({ port: 19998 });
  const progress = {};

  try {
    for (let i = 0; i < 20; ++i) {
      await src.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    for await (const output of migrate(
      "http://localhost:19999",
      "http://localhost:19998",
      {
        logger,
        progress,
        transform(event) {
          if (event.type === "type_2" || event.type === "type_4") {
            return {
              type: "something_new",
            };
          }

          return true;
        },
      },
    )) {
      logger.info(output);
    }
    const results = await dest.query({ from: 0 });

    expect(results).toHaveLength(20);
    expect(progress).toEqual({
      srcId: 20,
      destId: 20,
    });
    expect(results).toMatchSnapshot(
      "replace type_2 and type_4 to something_new",
    );
    expect(logs).toMatchSnapshot("DEBUG level logs");
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});

test("it should not proceed if new event doesn't include a type property", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { server: srv1, queue: src } = await makeServer({ port: 19999 });
  const { server: srv2, queue: dest } = await makeServer({ port: 19998 });
  const progress = {};

  try {
    for (let i = 0; i < 20; ++i) {
      await src.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    for await (const output of migrate(
      "http://localhost:19999",
      "http://localhost:19998",
      {
        logger,
        progress,
        transform(event) {
          if (event.type === "type_2") {
            delete event.type;
            return true;
          }

          return true;
        },
      },
    )) {
      logger.info(output);
    }
    const results = await dest.query({ from: 0 });

    expect(results).toHaveLength(2);
    expect(progress).toEqual({
      srcId: 2,
      destId: 2,
    });
    expect(results).toMatchSnapshot("stop after 2 events");
    expect(logs).toMatchSnapshot("DEBUG level logs");
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});

test("it should be able to resume from a progress object if specified", async () => {
  jest.setTimeout(1000);
  const [logger, logs] = makeTestLogger();
  const { server: srv1, queue: src } = await makeServer({ port: 19999 });
  const { server: srv2, queue: dest } = await makeServer({ port: 19998 });

  try {
    for (let i = 0; i < 20; ++i) {
      await src.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    for (let i = 0; i < 10; ++i) {
      await dest.commit({
        type: "type_" + (i % 10),
        payload: { key: i },
      });
    }

    const progress = {
      srcId: 10,
      destId: 10,
    };

    for await (const output of migrate(
      "http://localhost:19999",
      "http://localhost:19998",
      {
        progress,
        logger,
      },
    )) {
      logger.info(output);
    }
    const results = await dest.query({ from: 0 });

    expect(results).toHaveLength(20);

    expect(results).toMatchSnapshot("replicate everything");
    expect(logs).toMatchSnapshot("DEBUG level logs");
  } finally {
    srv1.destroy();
    srv2.destroy();
  }
});
