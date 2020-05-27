const t = require("../cypher-transform-update");

describe("transform update query", () => {
  test("CREATE: should add namespace, version and operation to new nodes", () => {
    const input = /* cypher */ `CREATE (node:LABEL { key: "value"});`;
    const output = /* cypher */ `CREATE (node:LABEL {
  key: "value",
  __ns: $upd.__ns,
  __v: $upd.__v,
  __op: $upd.__op
});`;

    expect(t(input)).toEqual(output);
  });

  test("CREATE: should not add version and operation to old nodes", () => {
    const input = /* cypher */ `MATCH (node) WITH node CREATE (other:LABEL { key: "value"});`;
    const output = /* cypher */ `MATCH (node { __ns: $upd.__ns })
WITH node
CREATE (other:LABEL {
  key: "value",
  __ns: $upd.__ns,
  __v: $upd.__v,
  __op: $upd.__op
});`;

    expect(t(input)).toEqual(output);
  });

  test("MERGE: should add namespace in condition and extend new nodes with $upd", () => {
    const input = /* cypher */ `MERGE (node:LABEL { key: "value"});`;
    const output = /* cypher */ `MERGE (node:LABEL {
  key: "value",
  __ns: $upd.__ns
})
ON CREATE SET node += $upd;`;

    expect(t(input)).toEqual(output);
  });

  test("MERGE: should add namespace in MATCH but not __v and __op", () => {
    const input = /* cypher */ `MATCH (something {x: "y"}) WITH something MERGE (node:LABEL { key: "value"});`;
    const output = /* cypher */ `MATCH (something {
  x: "y",
  __ns: $upd.__ns
})
WITH something
MERGE (node:LABEL {
  key: "value",
  __ns: $upd.__ns
})
ON CREATE SET node += $upd;`;

    expect(t(input)).toEqual(output);
  });
});
