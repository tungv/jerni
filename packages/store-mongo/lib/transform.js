const { applyInsertOne, applyInsertMany } = require("./optimistic/insert");
const { applyUpdateMany, applyUpdateOne } = require("./optimistic/update");
const { applyDeleteMany, applyDeleteOne } = require("./optimistic/remove");

const transform = (transformFn, event) => {
  const rawOps = transformFn(event);

  const enhancedOps = rawOps.reduce(
    ({ ops, nextOpId }, op) => {
      const ret = applyOptimisticLocking(op, event.id, nextOpId);

      return {
        ops: ops.concat(ret.ops),
        nextOpId: nextOpId + ret.nextOpId,
      };
    },
    { ops: [], nextOpId: 0 },
  );

  return enhancedOps.ops;
};

const applyOptimisticLocking = (op, eventId, opId) => {
  if (op.insertOne) {
    return applyInsertOne(op, eventId, opId);
  }
  if (op.insertMany) {
    return applyInsertMany(op, eventId, opId);
  }
  if (op.updateOne) {
    return applyUpdateOne(op, eventId, opId);
  }
  if (op.updateMany) {
    return applyUpdateMany(op, eventId, opId);
  }
  if (op.deleteOne) {
    return applyDeleteOne(op, eventId, opId);
  }
  if (op.deleteMany) {
    return applyDeleteMany(op, eventId, opId);
  }

  return { ops: [], nextOpId: opId };
};

module.exports = transform;
