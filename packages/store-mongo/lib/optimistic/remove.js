const returnEmptyOnException = require('../returnEmptyOnException');

exports.applyDeleteMany = returnEmptyOnException((op, eventId, opId) => {
  return {
    ops: [{ deleteMany: rawDelete(op.deleteMany, eventId, opId) }],
    nextOpId: opId + 1,
  };
});

exports.applyDeleteOne = returnEmptyOnException((op, eventId, opId) => {
  return {
    ops: [{ deleteOne: rawDelete(op.deleteOne, eventId, opId) }],
    nextOpId: opId + 1,
  };
});

const rawDelete = ({ where }, eventId, opId) => {
  const filter = {
    $and: [
      where,
      {
        $or: [{ __v: { $lt: eventId } }, { __v: eventId, __op: { $lt: opId } }],
      },
    ],
  };

  return { filter };
};
