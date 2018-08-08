const returnEmptyOnException = require('../returnEmptyOnException');
const rawInsert = require('./rawInsert');

module.exports = returnEmptyOnException((op, eventId, opId) => {
  const doc = op.insertOne;

  const ops = [rawInsert(doc, eventId, opId)];

  return { ops, nextOpId: opId + 1 };
});
