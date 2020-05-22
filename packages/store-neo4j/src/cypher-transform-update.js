const { parse } = require("cypher.js");
const transformAndFormat = require("cypher.js/src/format");

const caches = {};
module.exports = query => {
  if (!caches[query]) caches[query] = format(query);

  return caches[query];
};

function format(query) {
  const ast = parse(query);

  return transformAndFormat(ast, transform);
}

function addProperties(node, props) {
  node.properties = node.properties || { type: "map", entries: {} };

  Object.assign(node.properties.entries, props);
}

function fromParam(paramName, key) {
  return {
    type: "property-operator",
    expression: { type: "parameter", name: paramName },
    propName: { type: "prop-name", value: key },
  };
}

function from$upd(key) {
  return fromParam("upd", key);
}

function transform(walk) {
  let idCount = 0;
  let isMatching = false;
  let isMerging = false;
  let isCreating = false;

  const mergingNodes = [];

  const declaredIdentifiers = {};
  function declareIdentifier(id) {
    declaredIdentifiers[id] = true;
  }

  walk({
    match() {
      isMatching = true;
      return () => {
        isMatching = false;
      };
    },
    merge(node) {
      isMerging = true;
      mergingNodes.length = 0;
      return () => {
        if (mergingNodes.length > 0) {
          node.actions = node.actions || [];
          node.actions.push({
            type: "on-create",
            items: mergingNodes.map(nodeName => ({
              type: "merge-properties",
              identifier: { type: "identifier", name: nodeName },
              expression: { type: "parameter", name: "upd" },
            })),
          });
        }
        isMerging = false;
      };
    },
    create() {
      isCreating = true;
      return () => {
        isCreating = false;
      };
    },
    "node-pattern"(node) {
      const id = node.identifier ? node.identifier.name : `n_${++idCount}`;

      const declared = id in declaredIdentifiers;
      declareIdentifier(id);

      if (isMerging && !declared) {
        mergingNodes.push(id);
        addProperties(node, { __ns: from$upd("__ns") });
      }

      if (isCreating && !declared) {
        addProperties(node, {
          __ns: from$upd("__ns"),
          __v: from$upd("__v"),
          __op: from$upd("__op"),
        });
      }

      if (isMatching && !declared) {
        addProperties(node, { __ns: from$upd("__ns") });
      }
    },
  });
}
