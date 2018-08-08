const bulkWrite = async (db, commands) => {
  const groups = groupByCollectionName(commands);
  const promises = Object.entries(groups).map(([colName, ops]) => {
    const collectionPromise = db.collection(colName).bulkWrite(ops);
    return collectionPromise;
  });

  return promises;
};

const groupByCollectionName = commands => {
  const groups = {};

  for (const cmd of commands) {
    if (!groups[cmd.collection]) {
      groups[cmd.collection] = [];
    }

    groups[cmd.collection].push(...cmd.ops);
  }

  return groups;
};

module.exports = bulkWrite;
