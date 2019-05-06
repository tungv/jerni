const kefir = require("kefir");
const redis = require("redis");
const runLua = require("run-lua");

const { readFileSync } = require("fs");

const lua_commit = String(readFileSync(require.resolve("./commit.lua")));
const lua_query = String(readFileSync(require.resolve("./query.lua")));

const lua_latest = `
  if redis.call('exists', KEYS[1]) == 0 then
    return {0}
  end
  local id = tonumber(redis.call('get', KEYS[1]));

  return {id, redis.call('hget', KEYS[2], id)};
`;

const adapter = ({ url, ns = "local" }) => {
  const redisClient = redis.createClient(url);
  const subClient = redis.createClient(url);

  subClient.subscribe(`${ns}::events`);

  const events$ = kefir.fromEvents(subClient, "message", (channel, message) => {
    return message;
  });

  const commit = async event => {
    delete event.id;
    const id = await runLua(redisClient, lua_commit, {
      keys: [`{${ns}}::id`, `{${ns}}::events`, `{${ns}}::TYPE::${event.type}`],
      argv: [JSON.stringify(event), ns],
    });

    event.id = id;
    return event;
  };

  const getLatest = async () => {
    const [id, event] = await runLua(redisClient, lua_latest, {
      keys: [`{${ns}}::id`, `{${ns}}::events`],
    });

    if (id === 0) {
      return {
        id: 0,
        type: "@@INIT",
      };
    }

    return {
      ...JSON.parse(event),
      id,
    };
  };

  const internalQuery = async ({ from = -1, to, types = [] }) => {
    if (from === -1) {
      return { isEnd: true, array: [] };
    }

    try {
      const argv = [types.length, String(from)];

      if (typeof to !== "undefined") {
        argv.push(String(to));
      }

      const array = await runLua(redisClient, lua_query, {
        keys: [
          `{${ns}}::id`,
          `{${ns}}::events`,
          ...types.map(type => `{${ns}}::TYPE::${type}`),
        ],
        argv,
      });

      const _to = array.shift();
      const last = array.shift();
      const isEnd = _to >= last;

      return {
        isEnd,
        array: array.map(([id, event]) => ({
          ...JSON.parse(event),
          id,
        })),
      };
    } catch (ex) {
      console.error(ex.message);
      return { isEnd: true, array: [] };
    }
  };

  const destroy = () => {
    redisClient.quit();
    subClient.quit();
  };

  async function* generate(from, max, time, includingTypes = []) {
    let i = from;
    let subscription;

    const filter = includingTypes.length
      ? event => event.id > i && includingTypes.includes(event.type)
      : event => event.id > i;

    const queue = [];

    try {
      while (true) {
        const to = i + max;
        const { isEnd, array } = await internalQuery({
          from: i,
          to,
          types: includingTypes,
        });

        const lastEvent = last(array);
        if (lastEvent) {
          i = lastEvent.id;
        }

        subscription = events$
          .map(message => {
            const rawId = message.split(":")[0];
            const id = Number(rawId);
            const rawEvent = message.slice(rawId.length + 1);

            const event = JSON.parse(rawEvent);
            event.id = id;
            return event;
          })
          .filter(filter)
          .observe(event => {
            const lastInQueue = last(queue);
            if (lastInQueue && lastInQueue.id === event.id) return;
            queue.push(event);
          });

        if (array.length) {
          yield array;
        }

        if (!isEnd) {
          i = to;
          // continue to query
          queue.length = 0;

          subscription.unsubscribe();
        } else {
          break;
        }
      }

      while (true) {
        if (queue.length) {
          const buffer = [...queue];
          queue.length = 0;
          yield buffer;
        }
        await sleep(time);
      }
    } finally {
      if (subscription) {
        subscription.unsubscribe();
      }
    }
  }

  const query = async (...args) => {
    const resp = await internalQuery(...args);
    return resp.array;
  };

  return { commit, generate, query, destroy, getLatest };
};

module.exports = adapter;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const last = array => (array.length >= 1 ? array[array.length - 1] : null);
