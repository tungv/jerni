const got = require("got");
const kefir = require("kefir");
const log4js = require("log4js");

const backoff = require("./backoff");
const getChunks = require("./getChunks");

const logger = log4js.getLogger("jerni/subscribe");

module.exports = async function subscribe({
  subscribeURL,
  lastSeenIdGetter,
  includes = [],
}) {
  const b = backoff({ seed: 10, max: 3000 });
  let lastSeenId = await lastSeenIdGetter();
  logger.debug("last seen id", lastSeenId);

  const pool = kefir.pool();

  const filterEvents = includes.length
    ? e => includes.includes(e.type)
    : x => x;

  const connectRealtime = realtimeFrom => {
    const realtime$ = kefir
      .stream(emitter => {
        logger.debug("attempting to subscribe from #%d", realtimeFrom);

        const resp$ = got.stream(subscribeURL, {
          headers: {
            "last-event-id": realtimeFrom,
            includes: includes.join(","),
          },
        });

        const retry = once(waitTime => {
          emitter.end();

          pool.unplug(realtime$);

          setTimeout(() => {
            lastSeenIdGetter().then(connectRealtime);
          }, waitTime);

          logger.info(`retrying after ${waitTime}ms`);
        });

        resp$.once("error", err => {
          logger.error("connection error");
          retry(b.next());
        });

        let req;

        resp$.on("request", r => {
          req = r;
        });

        resp$.once("data", () => {
          logger.info("connected");
          b.reset();
        });

        resp$.on("data", buffer => {
          const data = String(buffer);
          emitter.emit(data);
        });

        resp$.on("end", () => {
          logger.info("connection end");
          retry(b.next());
        });

        return () => {
          req.abort();
          resp$.end();
        };
      })
      .thru(getChunks)
      .thru(handleMsg(filterEvents));

    pool.plug(realtime$);
  };

  connectRealtime(lastSeenId);

  return pool;
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

const once = fn => {
  let tries = 0;
  return (...args) => {
    if (!tries++) {
      return fn(...args);
    }
  };
};
