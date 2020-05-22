const neo4j = require("neo4j-driver").v1;

const Neo4jStore = require("../src/store");
const getConnectionObject = require("./getConnectionObject");

test("session#run() should be enhanced", async () => {
  const session = await getSessionForTest();

  const res = await session.run(/* cypher */ `
    MATCH (n:TestNode { thisIsATest: 'value'}) RETURN n;
  `);

  expect(res.records).toHaveLength(1);
});

test("explicit transaction should be enhanced", async () => {
  const session = await getSessionForTest();

  const explicitTransaction = session.beginTransaction();
  let results;
  try {
    results = await explicitTransaction.run(/* cypher */ `
      MATCH (n:TestNode { thisIsATest: 'value'}) RETURN n;
    `);
  } finally {
    await session.close();
  }

  expect(results.records).toHaveLength(1);
});

test("async read-only transaction should be enhanced", async () => {
  const session = await getSessionForTest();

  let results;
  try {
    results = await session.readTransaction(transaction =>
      transaction.run(/* cypher */ `
    MATCH (n:TestNode { thisIsATest: 'value'}) RETURN n;
    `)
    );
  } finally {
    await session.close();
  }

  expect(results.records).toHaveLength(1);
});

async function getSessionForTest() {
  const connection = getConnectionObject();
  const store = new Neo4jStore({
    name: "test-1",
    models: [],
    ...connection,
  });
  const neo4jDriver = neo4j.driver(
    connection.url,
    neo4j.auth.basic(connection.user, connection.password),
    { disableLosslessIntegers: true }
  );
  const rawSession = neo4jDriver.session();
  await rawSession.run(/* cypher */ `
    MERGE (n1:TestNode { __ns: 'test-1', thisIsATest: 'value' })
  `);
  await rawSession.run(/* cypher */ `
    MERGE (n1:TestNode { __ns: 'test-2', thisIsATest: 'value' })
  `);
  await rawSession.close();
  await neo4jDriver.close();
  expect(store.getDriver).toBeInstanceOf(Function);
  const driver = await store.getDriver();
  const session = driver.session();
  return session;
}
