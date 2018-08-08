const applyInsertMany = require('./optimistic/insertMany');

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
    { ops: [], nextOpId: 0 }
  );

  return enhancedOps.ops;
};

const applyOptimisticLocking = (op, eventId, opId) => {
  if (op.insertMany) {
    return applyInsertMany(op, eventId, opId);
  }

  return { ops: [], nextOpId: opId };
};

module.exports = transform;
