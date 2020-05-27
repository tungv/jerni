const makeNeo4jStore = require("../makeNeo4jStore");
const neo4j = require("neo4j-driver").default;

describe("Store", () => {
  it("should provide handleEvents method", async () => {
    await clean("test_1_v1");
    const model = simpleModel();
    const store = await makeNeo4jStore({
      name: "test_1",
      url: "bolt://localhost:7687",
      model,
      user: "neo4j",
      password: "test",
    });

    try {
      await store.handleEvents([
        { id: 1, type: "test" },
        { id: 2, type: "test" },
        { id: 3, type: "test" },
      ]);

      // this driver is 1) read-only 2) will only return the nodes within the namespace in most cases
      const driver = await store.getDriver(model);
      const session = driver.session();

      const result = await session.run(/* cypher */ `
        MATCH (item:Item) RETURN item ORDER BY id(item);
      `);

      const itemsProps = result.records.map(
        (r) => r.toObject().item.properties,
      );
      expect(itemsProps).toEqual([
        expect.objectContaining({ x: 1, __ns: "test_1_v1" }),
        expect.objectContaining({ x: 1, __ns: "test_1_v1" }),
        expect.objectContaining({ x: 1, __ns: "test_1_v1" }),
      ]);
      await session.close();
      await driver.close();
    } finally {
      await store.dispose();
    }
  });

  it("should return native driver that trap transactions to the specified namespace", async () => {
    await clean("test_ns_v1");
    const model = simpleModel();
    const store = await makeNeo4jStore({
      name: "test_ns",
      url: "bolt://localhost:7687",
      model,
      user: "neo4j",
      password: "test",
    });

    try {
      await store.handleEvents([
        { id: 1, type: "test" },
        { id: 2, type: "test" },
        { id: 3, type: "test" },
      ]);

      // this driver is 1) read-only 2) will only return the nodes within the namespace in most cases
      const driver = await store.getDriver(model);

      const query = /* cypher */ `
      MATCH (item:Item) RETURN count(item) as count;
    `;

      const session = driver.session();

      const result = await session.run(query);

      expect(result.records[0].get("count")).toEqual(3);

      // transactions
      const trx = session.beginTransaction();

      const trxResult = await trx.run(query);
      expect(trxResult.records[0].get("count")).toEqual(3);
      await trx.commit();

      await session.close();

      const rxSession = driver.rxSession();
      const d1 = defer();
      const rxResult = await rxSession.run(query);

      rxResult.records().subscribe({
        next(value) {
          d1.resolve(value);
        },
      });
      const record = await d1.promise;

      expect(record.get("count")).toEqual(3);

      await rxSession.close();

      await driver.close();
    } finally {
      await store.dispose();
    }
  });

  it("should not let you call writeTransaction on read-only driver", async () => {
    await clean("test_write_trx_v1");
    const model = simpleModel();
    const store = await makeNeo4jStore({
      name: "test_ns",
      url: "bolt://localhost:7687",
      model,
      user: "neo4j",
      password: "test",
    });
    const driver = await store.getDriver(model);

    try {
      const session = driver.session();
      expect(() =>
        session.writeTransaction(async () => {
          // do nothing
        }),
      ).toThrow(
        "starting a WRITE transaction on a read-only driver is not allowed",
      );
    } finally {
      await driver.close();
      await store.dispose();
    }
  });

  it("should not let you use explicit transaction (RxSession) on read-only driver", async () => {
    await clean("test_write_trx_v1");
    const model = simpleModel();
    const store = await makeNeo4jStore({
      name: "test_ns",
      url: "bolt://localhost:7687",
      model,
      user: "neo4j",
      password: "test",
    });
    const driver = await store.getDriver(model);

    try {
      const session = driver.rxSession();
      expect(() => session.beginTransaction()).toThrow(
        "@jerni/store-neo4j does NOT support RxSession#beginTransaction()",
      );
    } finally {
      await driver.close();
      await store.dispose();
    }
  });

  it("should not let you use create session with WRITE permission on read-only driver", async () => {
    await clean("test_write_trx_v1");
    const model = simpleModel();
    const store = await makeNeo4jStore({
      name: "test_ns",
      url: "bolt://localhost:7687",
      model,
      user: "neo4j",
      password: "test",
    });
    const driver = await store.getDriver(model);

    try {
      expect(() =>
        driver.session({ defaultAccessMode: neo4j.session.WRITE }),
      ).toThrow("creating a session with WRITE persmission is not allowed");
    } finally {
      await driver.close();
      await store.dispose();
    }
  });

  it("should update last seen", async () => {
    await clean("test_2_v1");
    const model = simpleModel();
    const store = await makeNeo4jStore({
      name: "test_2",
      url: "bolt://localhost:7687",
      model,
      user: "neo4j",
      password: "test",
    });
    try {
      const lastSeenAtTheBeginning = await store.getLastSeenId();

      expect(lastSeenAtTheBeginning).toBe(0);

      await store.handleEvents([
        { id: 1, type: "test" },
        { id: 2, type: "test" },
        { id: 3, type: "test" },
      ]);

      const lastSeenAfterUpdate = await store.getLastSeenId();

      expect(lastSeenAfterUpdate).toBe(3);
    } finally {
      await store.dispose();
    }
  });

  it("should be able to subscribe to new changes on different store instance", async () => {
    // make 2 store
    await clean("test_3_v1");

    const model = simpleModel();
    const storeForPublish = await makeNeo4jStore({
      name: "test_3",
      url: "bolt://localhost:7687",
      model,
      user: "neo4j",
      password: "test",
    });

    const storeForSubscribe = await makeNeo4jStore({
      name: "test_3",
      url: "bolt://localhost:7687",
      model,
      user: "neo4j",
      password: "test",
    });

    try {
      (async function () {
        await sleep(100);
        await storeForPublish.handleEvents([{ id: 1, type: "test" }]);
        await sleep(100);
        await storeForPublish.handleEvents([{ id: 2, type: "test" }]);
        await storeForPublish.dispose();
      })();

      for await (const checkpoint of storeForSubscribe.listen()) {
        if (checkpoint === 2) {
          break;
        }
      }
    } finally {
      await storeForSubscribe.dispose();
    }
  });
});

function simpleModel() {
  return {
    name: "test_model",
    version: "1",
    transform(event) {
      return { query: /* cypher */ `CREATE (node:Item { x: 1 }) RETURN node` };
    },
  };
}

async function clean(ns) {
  const driver = neo4j.driver(
    "bolt://localhost:7687",
    neo4j.auth.basic("neo4j", "test"),
  );
  const session = driver.session();
  await session.run(/* cypher */ `MATCH (n { __ns: $ns }) DETACH DELETE n`, {
    ns,
  });

  await session.close();
  await driver.close();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function defer() {
  let resolve, reject;

  const promise = new Promise((_1, _2) => {
    resolve = _1;
    reject = _2;
  });
  return {
    promise,
    resolve,
    reject,
  };
}
