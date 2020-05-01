const adapter = require("../src/index");
const { Client } = require("pg");
test("[optimization] back-pressure for generate()", async () => {
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
    for (let i = 0; i < 200; ++i)
      await queue.commit({ type: "test_" + (i <= 50 || i > 150 ? "1" : "2") });

    const querySpy = jest.spyOn(Client.prototype, "query");
    let counter = 0;
    for await (const batch of queue.generate(0, 10, 10, ["test_1"])) {
      expect(batch).toHaveLength(10);
      if (++counter === 10) {
        break;
      }
      await sleep(100);
    }

    // first query needs a 'SET message_store.sql_condition TO TRUE'
    expect(querySpy).toHaveBeenCalledTimes(11);
  } finally {
    await queue.destroy();
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
