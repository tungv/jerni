const { parse } = require("cypher.js");
const transformAndFormat = require("cypher.js/src/format");

function addProperties(node, props) {
  node.properties = node.properties || { type: "map", entries: {} };

  Object.assign(node.properties.entries, props);
}

module.exports = function ensureNamespace(query, namespace) {
  const ast = parse(
    query
      .replace(/\$\d/g, $1 => `$ESCAPED_${$1}`)
      .split("apoc.cypher.runFirstColumn")
      .join("`apoc.cypher.runFirstColumn`")
  );

  return transformAndFormat(ast, walk => {
    let idCount = 0;
    const declaredIdentifiers = {};
    function declareIdentifier(id) {
      declaredIdentifiers[id] = true;
    }

    let isMatching = false;
    walk({
      match() {
        isMatching = true;
        return () => {
          isMatching = false;
        };
      },
      merge() {
        throw new Error(
          "Neo4jStore(jerni): write operations [MERGE] are forbidden on this read-only driver."
        );
      },
      create() {
        throw new Error(
          "Neo4jStore(jerni): write operations [CREATE] are forbidden on this read-only driver."
        );
      },
      delete() {
        throw new Error(
          "Neo4jStore(jerni): write operations [DELETE] are forbidden on this read-only driver."
        );
      },

      "node-pattern"(node) {
        const id = node.identifier ? node.identifier.name : `n_${++idCount}`;

        const declared = id in declaredIdentifiers;
        declareIdentifier(id);

        if (isMatching && !declared) {
          addProperties(node, {
            __ns: {
              type: "string",
              value: namespace,
            },
          });
        }
      },

      parameter(node) {
        if (node.name.startsWith("ESCAPED_$")) {
          node.name = node.name.substr("ESCAPED_$".length);
        }
      },
    });
  });
};
