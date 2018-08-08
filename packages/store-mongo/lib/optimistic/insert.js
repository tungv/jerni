const returnEmptyOnException = require('../returnEmptyOnException');

exports.applyInsertOne = returnEmptyOnException((op, eventId, opId) => {
  const doc = op.insertOne;
  const ops = [rawInsert(doc, eventId, opId)];
  return { ops, nextOpId: opId + 1 };
});

exports.applyInsertMany = returnEmptyOnException((op, eventId, opId) => {
  const docs = op.insertMany;
  const ops = docs.map((doc, index) => rawInsert(doc, eventId, opId + index));
  return { ops, nextOpId: opId + docs.length };
});

const makeOptimisticInsertCondition = (eventId, opId) => {
  const gtEventId = { __v: { $gt: eventId } };
  const gtOpCounterInSameEvent = { __op: { $gt: opId }, __v: eventId };

  return {
    $or: [gtEventId, gtOpCounterInSameEvent],
  };
};

const rawInsert = (doc, eventId, opId) => ({
  updateOne: {
    filter: makeOptimisticInsertCondition(eventId, opId),
    update: {
      $setOnInsert: Object.assign(
        {
          __v: eventId,
          __op: opId,
        },
        doc
      ),
    },
    upsert: true,
  },
});
