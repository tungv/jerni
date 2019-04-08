const { router, get, post } = require("microrouter");
const micro = require("micro");

const { getLastEventId, getBurstCount, getBurstTime } = require("./utils");

const over = arrayFns => param => arrayFns.map(fn => fn(param));
const once = fn => {
  let run = false;

  return (...params) => {
    if (run) {
      return;
    }

    run = true;
    fn(...params);
  };
};

const always = v => () => v;

const toOutput = events => `id: ${events[events.length - 1].id}
event: INCMSG
data: ${JSON.stringify(events)}

`;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const factory = async userConfig => {
  const { queue, http } = await parseConfig(userConfig || {});

  const service = router(
    get(http.queryPath, async req => {
      const lastEventId = req.query.lastEventId;

      return queue.query({ from: lastEventId });
    }),
    get(`${http.eventsPath}/latest`, () => {
      return queue.getLatest();
    }),
    post(http.commitPath, async req => {
      const body = await micro.json(req);

      if (typeof body.type !== "string") {
        throw micro.createError(400, "type is required");
      }

      return queue.commit(body);
    }),
    get(http.subscribePath, async (req, res) => {
      const [lastEventId = 0, count = 20, time = 1] = over([
        getLastEventId,
        getBurstCount,
        getBurstTime,
      ])(req);

      let ended = false;

      const removeClient = once(() => {
        // opts.debug && console.log('removing', req.url);
        // subscription.unsubscribe();
        ended = true;
        res.end();
      });

      req.on("end", removeClient);
      req.on("close", removeClient);
      res.on("finish", removeClient);

      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      req.socket.setKeepAlive(true);

      res.writeHead(200, {
        "Content-Type": "text/event-stream;charset=UTF-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      res.write(":ok\n\n");
      await sleep(0);
      flush(res);

      const stream = queue.generate(lastEventId, count, time, always(true));

      try {
        for await (let buffer of stream) {
          if (ended) {
            break;
          }
          if (buffer.length) res.write(toOutput(buffer));
        }
      } catch (ex) {
        console.error(ex);
        removeClient();
      }
    }),
  );

  return service;
};

const getQueue = queueConfigOrActualQueue => {
  if (typeof queueConfigOrActualQueue.subscribe === "function") {
    return queueConfigOrActualQueue;
  }

  const adapterPkgName =
    queueConfigOrActualQueue.driver || "./adapters/in-memory";
  const adapter = require(adapterPkgName);
  return adapter(queueConfigOrActualQueue);
};

const parseConfig = ({ queue: queueConfig = {}, http: httpConfig = {} }) => {
  const {
    commitPath = "/commit",
    subscribePath = "/subscribe",
    queryPath = "/query",
    eventsPath = "/events",
    port,
  } = httpConfig;

  if (Number.isNaN(port)) {
    console.error("port is unspecified");
    process.exit(1);
  }

  return {
    queue: getQueue(queueConfig),
    http: {
      commitPath,
      subscribePath,
      queryPath,
      eventsPath,
      port,
    },
  };
};

module.exports = factory;

function flush(response) {
  if (response.flush && response.flush.name !== "deprecated") {
    response.flush();
  }
}
