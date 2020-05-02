const adapter = require("../src/index");

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

test("commit: id should go up", async () => {
  const queue = makeQueue();

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
  const queue = makeQueue();

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
  const queue = makeQueue();

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

test("query: should return a certain type of events within a range of id", async () => {
  const queue = makeQueue();

  try {
    for (let i = 0; i < 10; ++i) {
      await queue.commit({
        type: "test_" + ((i + 1) % 3),
        payload: { key: i + 1, another: "test,test" },
      });
    }
    const [e4, e6, e7, e9] = await queue.query({
      from: 3,
      to: 8,
      types: ["test_1", "test_0"],
    });
    expect(e4).toEqual({
      id: 4,
      type: "test_1",
      payload: { key: 4, another: "test,test" },
      meta: {},
    });
    expect(e6).toEqual({
      id: 6,
      type: "test_0",
      payload: { key: 6, another: "test,test" },
      meta: {},
    });
    expect(e7).toEqual({
      id: 7,
      type: "test_1",
      payload: { key: 7, another: "test,test" },
      meta: {},
    });
    expect(e9).toBeUndefined();
  } finally {
    await queue.destroy();
  }
});

test("generate: should iterator through all events", async () => {
  jest.setTimeout(1000);
  const queue = makeQueue();

  try {
    // seed 10 events with different types
    for (let i = 0; i < 10; ++i) {
      await queue.commit({
        type: "test_" + ((i + 1) % 3),
        payload: { key: i + 1, another: "test,test" },
      });
    }

    let outputs = [];
    let count = 0;
    for await (const buffer of queue.generate(0, 5, 100, [])) {
      expect(buffer).toBeInstanceOf(Array);
      expect(buffer).toHaveLength(5);
      outputs.push(...buffer);
      if (++count === 2) {
        break;
      }
    }

    expect(outputs).toHaveLength(10);
  } finally {
    await queue.destroy();
  }
});

test("generate: should iterator through a certain type events", async () => {
  jest.setTimeout(1000);
  const queue = makeQueue();

  try {
    // seed 10 events with different types
    for (let i = 0; i < 10; ++i) {
      await queue.commit({
        type: "test_" + ((i + 1) % 3),
        payload: { key: i + 1, another: "test,test" },
      });
    }

    let outputs = [];
    let count = 0;

    //  1  2  3  4  5  6  7  8  9 10
    // _1 _2 _0 _1 _2 _0 _1 _2 _0 _1
    //  x  _  x  x  _  x  x  _  x  x
    // [<---------1------->] [<-2->]

    for await (const buffer of queue.generate(0, 5, 100, [
      "test_0",
      "test_1",
    ])) {
      expect(buffer).toBeInstanceOf(Array);
      outputs.push(...buffer);
      if (count === 0) {
        expect(buffer).toHaveLength(5);
      }

      if (count === 1) {
        expect(buffer).toHaveLength(2);
        break;
      }
      ++count;
    }

    expect(outputs).toHaveLength(7);
  } finally {
    await queue.destroy();
  }
});

test("generate: should continue to yield events", async () => {
  const queue = makeQueue();

  try {
    for (let i = 0; i < 5; ++i) await queue.commit({ type: "test_1" });

    sleep(100).then(async () => {
      await queue.commit({ type: "test_2" });
      await sleep(100);
      await queue.commit({ type: "test_2" });
      await sleep(100);
      await queue.commit({ type: "test_2" });
      await sleep(100);
      await queue.commit({ type: "test_2" });
      await sleep(100);
      await queue.commit({ type: "test_2" });
      await sleep(100);
    });

    let received = 0;
    for await (const batch of queue.generate(0, 2, 50, [])) {
      received += batch.length;
      if (received === 10) {
        break;
      }
    }
  } finally {
    await queue.destroy();
  }
});

test("generate: should continue to yield events from an empty queue", async () => {
  const queue = makeQueue();

  try {
    sleep(100).then(async () => {
      for (let i = 0; i < 5; ++i) await queue.commit({ type: "test_1" });
      await queue.commit({ type: "test_2" });
      await sleep(100);
      await queue.commit({ type: "test_2" });
      await sleep(100);
      await queue.commit({ type: "test_2" });
      await sleep(100);
      await queue.commit({ type: "test_2" });
      await sleep(100);
      await queue.commit({ type: "test_2" });
      await sleep(100);
    });

    let received = 0;
    for await (const batch of queue.generate(0, 2, 50, [])) {
      received += batch.length;
      if (received === 10) {
        break;
      }
    }
  } finally {
    await queue.destroy();
  }
});

test("generate: should always maintain orders", async () => {
  const queue = makeQueue();

  try {
    sleep(100).then(async () => {
      for (let i = 0; i < 10; ++i) {
        // this can come in any order, but the result of generate must match with query all
        queue.commit({ type: "test_1", payload: { i } });
      }
    });

    let received = [];
    for await (const batch of queue.generate(0, 2, 50, [])) {
      received.push(...batch);
      if (received.length === 10) {
        break;
      }
    }

    const all = await queue.query({ from: 0, to: 10 });

    expect(received).toEqual(all);
  } finally {
    await queue.destroy();
  }
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
