const returnEmptyOnException = require('../returnEmptyOnException');

module.exports = returnEmptyOnException((op, eventId, opId) => {
  const docs = op.updateMany;

  const { changes, change, where } = op.updateMany;

  const { $set = {}, ...others } = { ...(change || changes) };

  const optimistic$set = Object.assign({}, $set, {
    __v: eventId,
    __op: opId,
  });

  const update = Object.assign({ $set: optimistic$set }, others);

  const filter = {
    $and: [
      where,
      {
        $or: [{ __v: { $lt: eventId } }, { __v: eventId, __op: { $lt: opId } }],
      },
    ],
  };

  return {
    ops: [{ updateMany: { filter, update, upsert: false } }],
    nextOpId: opId + 1,
  };
});
