const arrify = require("arrify");
const identity = x => x;

module.exports = rules => {
  const meta = {
    includes: Object.keys(rules),
  };

  function transform(event) {
    if (typeof rules[event.type] !== "function") {
      return [];
    }

    const ops = arrify(rules[event.type](event));

    return ops.filter(identity);
  }

  transform.meta = meta;
  return transform;
};
