const returnEmptyOnException = require('../returnEmptyOnException');

module.exports = returnEmptyOnException((op, eventId, opId) => {
  const docs = op.insertMany;

  const ops = docs.map((doc, index) => {
    const opCounter = opId + index;
    const gtEventId = { __v: { $gt: eventId } };
    const gtOpCounterInSameEvent = { __op: { $gt: opCounter }, __v: eventId };

    const gtEventIdOrGtOpCounterInSameEvent = {
      $or: [gtEventId, gtOpCounterInSameEvent],
    };

    const $setOnInsert = Object.assign(
      {
        __v: eventId,
        __op: opCounter,
      },
      doc
    );

    return {
      updateOne: {
        filter: gtEventIdOrGtOpCounterInSameEvent,
        update: { $setOnInsert },
        upsert: true,
      },
    };
  });

  return { ops, nextOpId: opId + docs.length };
});
