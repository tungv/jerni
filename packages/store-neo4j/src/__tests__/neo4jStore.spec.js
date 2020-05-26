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

    await store.handleEvents([
      { id: 1, type: "test" },
      { id: 2, type: "test" },
      { id: 3, type: "test" },
    ]);

    const driver = await store.getDriver(model);
    const session = driver.session();

    const result = await session.run(/* cypher */ `
      MATCH (item:Item) RETURN item ORDER BY id(item);
    `);

    const itemsProps = result.records.map((r) => r.toObject().item.properties);
    expect(itemsProps).toEqual([
      expect.objectContaining({ x: 1, __ns: "test_1_v1" }),
      expect.objectContaining({ x: 1, __ns: "test_1_v1" }),
      expect.objectContaining({ x: 1, __ns: "test_1_v1" }),
    ]);
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

    const lastSeenAtTheBeginning = await store.getLastSeenId();

    expect(lastSeenAtTheBeginning).toBe(0);

    await store.handleEvents([
      { id: 1, type: "test" },
      { id: 2, type: "test" },
      { id: 3, type: "test" },
    ]);

    const lastSeenAfterUpdate = await store.getLastSeenId();

    expect(lastSeenAfterUpdate).toBe(3);
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

    (async function () {
      await sleep(100);
      await storeForPublish.handleEvents([{ id: 1, type: "test" }]);
      await sleep(100);
      await storeForPublish.handleEvents([{ id: 2, type: "test" }]);
    })();

    for await (const checkpoint of storeForSubscribe.listen()) {
      if (checkpoint === 2) {
        break;
      }
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
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
