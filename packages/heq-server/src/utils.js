const getNumberFromReq = ({ header, query }) => req => {
  const fromHeaders = Number(req.headers[header]);

  if (!isNaN(fromHeaders)) {
    return fromHeaders;
  }

  // try query
  const fromQuery = Number(req.query[query]);
  if (!isNaN(fromQuery)) {
    return fromQuery;
  }
};

const getLastEventId = getNumberFromReq({
  header: 'last-event-id',
  query: 'lastEventId',
});
const getBurstCount = getNumberFromReq({
  header: 'burst-count',
  query: 'burstCount',
});
const getBurstTime = getNumberFromReq({
  header: 'burst-time',
  query: 'burstTime',
});
const getRetry = getNumberFromReq({
  header: 'retry',
  query: 'retry',
});

const tryParse = raw => {
  try {
    return JSON.parse(raw);
  } catch (ex) {
    return { type: '@@RAW', payload: raw };
  }
};

exports.getLastEventId = getLastEventId;
exports.getBurstCount = getBurstCount;
exports.getBurstTime = getBurstTime;
exports.getRetry = getRetry;
exports.tryParse = tryParse;
