const makeOptimisticInsertCondition = (eventId, opId) => {
  const gtEventId = { __v: { $gt: eventId } };
  const gtOpCounterInSameEvent = { __op: { $gt: opId }, __v: eventId };

  return {
    $or: [gtEventId, gtOpCounterInSameEvent],
  };
};

const insertOne = (doc, eventId, opId) => ({
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

module.exports = insertOne;
