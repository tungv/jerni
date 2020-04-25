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
