const returnEmptyOnException = require("../returnEmptyOnException");

exports.applyUpdateMany = returnEmptyOnException((op, eventId, opId) => {
  return {
    ops: [{ updateMany: rawUpdate(op.updateMany, eventId, opId) }],
    nextOpId: opId + 1
  };
});

exports.applyUpdateOne = returnEmptyOnException((op, eventId, opId) => {
  return {
    ops: [{ updateOne: rawUpdate(op.updateOne, eventId, opId) }],
    nextOpId: opId + 1
  };
});

const rawUpdate = (
  { changes, change, where, upsert = false, arrayFilters },
  eventId,
  opId
) => {
  const { $set = {}, ...others } = { ...(change || changes) };

  const optimistic$set = Object.assign({}, $set, {
    __v: eventId,
    __op: opId
  });

  const update = Object.assign({ $set: optimistic$set }, others);

  const filter = {
    $and: [
      where,
      {
        $or: [{ __v: { $lt: eventId } }, { __v: eventId, __op: { $lt: opId } }]
      }
    ]
  };

  if (arrayFilters) {
    return { filter, update, upsert, arrayFilters };
  }
  return { filter, update, upsert };
};
