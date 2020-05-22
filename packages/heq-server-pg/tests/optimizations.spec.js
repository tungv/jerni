const adapter = require("../src/index");
const { Client } = require("pg");

function makeQueue() {
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
  return queue;
}

test("[optimization] back-pressure for generate()", async () => {
  const queue = makeQueue();

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
    // generate will also call LISTEN
    expect(querySpy).toHaveBeenCalledTimes(12);
  } finally {
    await queue.destroy();
  }
});

test("[optimaization] generate: should continue to yield events with NOFITY/LISTEN", async () => {
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
    for (let i = 0; i < 5; ++i) await queue.commit({ type: "test_1" });

    sleep(100).then(async () => {
      // 1 commit
      await queue.commit({ type: "test_2" });
      await sleep(20);
      // 2 commit
      await queue.commit({ type: "test_2" });
      await sleep(20);
      // 3 commit
      await queue.commit({ type: "test_2" });
      await sleep(20);
      // 4 commit
      await queue.commit({ type: "test_2" });
      await sleep(20);
      // 5 commit
      await queue.commit({ type: "test_2" });
      await sleep(20);
    });

    const querySpy = jest.spyOn(Client.prototype, "query");

    let received = 0;
    for await (const batch of queue.generate(0, 2, 10, [])) {
      received += batch.length;
      if (received === 10) {
        break;
      }
    }

    // there should be 5 COMMIT
    // and 1 SETTING
    // and 3 catching up queries
    // from that on, only NOTIFY and LISTEN should be running
    expect(
      querySpy.mock.calls.filter(
        ([sql]) => sql.ns === "heq-" + ns && sql.name === "get_all_types",
      ),
    ).toHaveLength(4);
  } finally {
    await queue.destroy();
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
