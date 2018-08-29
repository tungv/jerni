const arrify = require('arrify');
const identity = x => x;

module.exports = rules => {
  return event => {
    if (typeof rules[event.type] !== 'function') {
      return [];
    }

    const ops = arrify(rules[event.type](event));

    return ops.filter(identity);
  };
};
