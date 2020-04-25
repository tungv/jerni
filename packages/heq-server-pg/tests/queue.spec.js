const adapter = require("../src/index");

test("commit: id should go up", async () => {
  const ns = `ns__${Math.random()}`;
  const queue = adapter({
    ns,
    connection: {
      host: "localhost",
      port: "54320",
      password: "simple",
      user: "message_store",
      database: "message_store",
    },
  });

  try {
    const events = [];
    for (let i = 0; i < 10; ++i) {
      events.push(
        await queue.commit({
          type: "test",
          payload: { key: i + 1 },
        }),
      );
    }
    expect(events).toEqual(
      Array.from({ length: 10 }, (i, index) => ({
        id: index + 1,
        type: "test",
        payload: { key: index + 1 },
        meta: {},
      })),
    );
  } finally {
    await queue.destroy();
  }
});

test("getLatest: should return latest event", async () => {
  const ns = `ns__${Math.random()}`;
  const queue = adapter({
    ns,
    connection: {
      host: "localhost",
      port: "54320",
      password: "simple",
      user: "message_store",
      database: "message_store",
    },
  });

  try {
    for (let i = 0; i < 10; ++i) {
      await queue.commit({
        type: "test",
        payload: { key: i + 1, another: "test,test" },
      });
    }

    const latest = await queue.getLatest();
    expect(latest).toEqual({
      id: 10,
      type: "test",
      payload: { key: 10, another: "test,test" },
      meta: {},
    });
  } finally {
    await queue.destroy();
  }
});

test("query: should return events within a range of id", async () => {
  const ns = `ns__${Math.random()}`;
  const queue = adapter({
    ns,
    connection: {
      host: "localhost",
      port: "54320",
      password: "simple",
      user: "message_store",
      database: "message_store",
    },
  });

  try {
    for (let i = 0; i < 10; ++i) {
      await queue.commit({
        type: "test",
        payload: { key: i + 1, another: "test,test" },
      });
    }
    const [e4, e5, e6, e7] = await queue.query({ from: 3, to: 6 });
    expect(e4).toEqual({
      id: 4,
      type: "test",
      payload: { key: 4, another: "test,test" },
      meta: {},
    });
    expect(e5).toEqual({
      id: 5,
      type: "test",
      payload: { key: 5, another: "test,test" },
      meta: {},
    });
    expect(e6).toEqual({
      id: 6,
      type: "test",
      payload: { key: 6, another: "test,test" },
      meta: {},
    });
    expect(e7).toBeUndefined();
  } finally {
    await queue.destroy();
  }
});
