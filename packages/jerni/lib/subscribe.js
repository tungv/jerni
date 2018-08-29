const got = require("got");

const kefir = require("kefir");

const getChunks = require("./getChunks");

module.exports = async function subscribe({
  queryURL,
  subscribeURL,
  lastSeenId,
  includes = []
}) {
  const { body: unreadEvents } = await got(
    `${queryURL}?lastEventId=${lastSeenId}`,
    {
      json: true
    }
  );

  const realtimeFrom = unreadEvents.length
    ? unreadEvents[unreadEvents.length - 1].id
    : lastSeenId;

  const pool = kefir.pool();

  const filterEvents = includes.length
    ? e => includes.includes(e.type)
    : x => x;

  const unread$ = kefir.constant(unreadEvents.filter(filterEvents));

  setTimeout(() => pool.plug(unread$), 1);
  unread$.onEnd(() => {
    const realtime$ = kefir
      .stream(emitter => {
        const resp$ = got.stream(`${subscribeURL}?lastEventId=${realtimeFrom}`);
        let req;

        resp$.on("request", r => {
          req = r;
        });

        resp$.on("data", buffer => {
          const data = String(buffer);
          emitter.emit(data);
        });

        resp$.on("end", () => {
          emitter.end();
        });

        return () => {
          req.abort();
          resp$.end();
        };
      })
      .thru(getChunks)
      .thru(handleMsg(filterEvents));

    pool.plug(realtime$);
  });

  return pool.filter();
};

const handleMsg = filterEvents => messages$ =>
  messages$
    .filter(msg => msg.event === "INCMSG")
    .map(msg => safeParseArray(msg.data).filter(filterEvents))
    .filter(x => x.length);

const safeParseArray = str => {
  try {
    return JSON.parse(str);
  } catch (ex) {
    return [];
  }
};
