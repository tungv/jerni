const { handleErrors } = require('micro-boom');
const { router, get, post } = require('microrouter');
const micro = require('micro');

const {
  getLastEventId,
  getBurstCount,
  getBurstTime,
  getRetry,
} = require('./utils');

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

      if (typeof body.type !== 'string') {
        throw micro.createError(400, 'type is required');
      }

      return queue.commit(body);
    }),
    get(http.subscribePath, async (req, res) => {
      const [lastEventId = 0, count = 20, time = 1, retry = 10] = over([
        getLastEventId,
        getBurstCount,
        getBurstTime,
        getRetry,
      ])(req);

      let ended = false;

      const removeClient = once(() => {
        // opts.debug && console.log('removing', req.url);
        // subscription.unsubscribe();
        ended = true;
        res.end();
      });

      req.on('end', removeClient);
      req.on('close', removeClient);
      res.on('finish', removeClient);

      req.socket.setTimeout(0);
      req.socket.setNoDelay(true);
      req.socket.setKeepAlive(true);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream;charset=UTF-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      res.write(':ok\n\n');
      flush(res);

      try {
        // subscribe
        const { events$, latest } = queue.subscribe();

        const pastEvents = await queue.query({
          from: lastEventId,
        });

        res.write(toOutput(pastEvents));

        events$
          .filter(e => e.id > pastEvents[pastEvents.length - 1].id)
          .bufferWithTimeOrCount(time, count)
          .filter(b => b.length)
          .map(toOutput)
          .observe(block => {
            // console.log('send to %s %s', req.url, block);
            if (!ended) res.write(block);
          });
      } catch (ex) {
        console.error(ex);
        res.end();
      }
    })
  );

  return service;
};

const parseConfig = ({ queue: queueConfig = {}, http: httpConfig = {} }) => {
  const adapterPkgName = queueConfig.driver || './adapters/in-memory';
  const adapter = require(adapterPkgName);

  const {
    commitPath = '/commit',
    subscribePath = '/subscribe',
    queryPath = '/query',
    eventsPath = '/events',
    port,
  } = httpConfig;

  if (Number.isNaN(port)) {
    console.error('port is unspecified');
    process.exit(1);
  }

  return {
    queue: adapter(queueConfig),
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
  if (response.flush && response.flush.name !== 'deprecated') {
    response.flush();
  }
}
