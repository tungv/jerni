const kefir = require("kefir");
const redis = require("redis");
const runLua = require("run-lua");

const lua_commit = `
  local event = ARGV[1];
  local counter = redis.call('INCR', KEYS[1]);

  redis.call('HSET', KEYS[2], counter, event);
  redis.call('PUBLISH', ARGV[2]..'::events', counter .. ':' .. event);
  return counter;
`;

const lua_query = `
if redis.call('exists', KEYS[1]) == 0 then
  return {}
end

local from = tonumber(ARGV[1]) + 1;
local to = tonumber(
  ARGV[2] or redis.call('get', KEYS[1])
);
local newArray = {};
local event

for id=from,to do
  if redis.call('hexists', KEYS[2], id) == 1 then
    table.insert(newArray, {id, redis.call('hget', KEYS[2], id)});
  end
end

return newArray
`;

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
      keys: [`{${ns}}::id`, `{${ns}}::events`],
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

  const query = async ({ from = -1, to }) => {
    if (from === -1) {
      return [];
    }
    try {
      const argv = [String(from)];

      if (typeof to !== "undefined") {
        argv.push(String(to));
      }

      const array = await runLua(redisClient, lua_query, {
        keys: [`{${ns}}::id`, `{${ns}}::events`],
        argv,
      });

      return array.map(([id, event]) => ({
        ...JSON.parse(event),
        id,
      }));
    } catch (ex) {
      return [];
    }
  };

  const destroy = () => {
    redisClient.quit();
    subClient.quit();
  };

  async function* generate(from, max, time, filter) {
    let i = from;
    let subscription;

    try {
      while (true) {
        const to = i + max;
        const batch = await query({ from: i, to });

        const matched = batch.filter(filter);
        if (matched.length) {
          // console.log("from query", matched);
          yield matched;
        }

        const lastEvent = last(batch);
        if (lastEvent) {
          i = last(batch).id;
        } else {
          break;
        }
        // await sleep(time);
      }

      const queue = [];

      subscription = events$
        .map(message => {
          const rawId = message.split(":")[0];
          const id = Number(rawId);
          const rawEvent = message.slice(rawId.length + 1);

          const event = JSON.parse(rawEvent);
          event.id = id;
          return event;
        })
        .filter(event => event.id > i)
        .filter(filter)
        .observe(event => {
          queue.push(event);
        });

      while (true) {
        if (queue.length) {
          const buffer = [...queue];
          queue.length = 0;
          // console.log("from sub", buffer);
          yield buffer;
        }
        await sleep(time);
      }
    } finally {
      if (subscription) subscription.unsubscribe();
    }
  }

  return { commit, generate, query, destroy, getLatest };
};

module.exports = adapter;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const last = array => (array.length >= 1 ? array[array.length - 1] : null);
