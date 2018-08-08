const returnEmptyOnException = require('../returnEmptyOnException');
const rawInsert = require('./rawInsert');

module.exports = returnEmptyOnException((op, eventId, opId) => {
  const docs = op.insertMany;

  const ops = docs.map((doc, index) => rawInsert(doc, eventId, opId + index));

  return { ops, nextOpId: opId + docs.length };
});
