const augmentDriver = require("./augmentDriver");

const enhanceQuery = require("./cypher-transform-update");

const neo4j = require("neo4j-driver").v1;
const PLazy = require("p-lazy");
const kefir = require("kefir");
const Store = require("@jerni/base/Store");

module.exports = class Neo4jStore extends Store {
  constructor({
    name,
    models,
    url,
    user,
    password,
    buffer = { time: 2, count: 100 },
  }) {
    super({ name, models, url });

    this.user = user;
    this.password = password;
    this.buffer = buffer;
    this.listeners = [];

    this.watch_timer = null;
  }

  async getDriver() {
    return getDriver(this, { readOnly: true });
  }

  async getLastSeenId() {
    const driver = getDriver(this, { readOnly: false });
    const session = driver.session();
    try {
      const snapshot = await session.run(
        /* cypher */ `MERGE (s:SNAPSHOT { __ns: $namespace}) ON CREATE SET s.__v = 0 RETURN s.__v as version`,
        { namespace: getNamespace(this.models[0], this) }
      );
      return snapshot.records[0] ? snapshot.records[0].get("version") : 0;
    } finally {
      session.close();
    }
  }

  watch() {
    if (this.watch_timer) {
      return;
    }

    this.watch_timer = setInterval(async () => {
      // console.time("getLastSeenId");
      const id = await this.getLastSeenId();
      // console.timeEnd("getLastSeenId");
      // console.log(id);
      this.notify(id);
    }, 250);
  }

  notify(id) {
    this.listeners.forEach(fn => fn(id));
  }

  subscribe(fn) {
    this.listeners.push(fn);

    this.watch();

    // unsubscribe
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== fn);
    };
  }

  async receive(stream) {
    const model = this.models[0];
    const store = this;
    function transform(events) {
      return new PLazy(async (resolve, reject) => {
        const commands = [];

        for (const event of events) {
          const cmds = optimisticLocking(
            arrify(model.transform(event)),
            event,
            getNamespace(model, store)
          );
          commands.push(...cmds);
        }

        let changes = {
          model,
          added: 0,
          modified: 0,
          removed: 0,
        };

        if (!commands.length) {
          resolve({
            events,
            models: [changes],
          });

          const committed = last(events).id;
          console.log("skipped v%d", committed);
          store.listeners.forEach(fn => fn(committed));
          return;
        }

        // console.log("committing %d ops", commands.length);
        const driver = getDriver(store, { readOnly: false });

        const session = driver.session();
        let lastQuery;
        try {
          const tx = session.beginTransaction();

          for (const cmd of commands) {
            // console.log(cmd);
            const [query, params] = cmd;
            lastQuery = query;
            // console.log(query);
            // console.log("%j", params);
            await tx.run(query, params);
          }

          await tx.commit();
          const committed = last(events).id;
          // console.log("committed v%d", committed);
          store.listeners.forEach(fn => fn(committed));

          resolve({
            events,
            models: [changes],
          });
        } catch (ex) {
          console.error(ex.message);
          console.error(ex.code);
          console.error(
            lastQuery
              .split("\n")
              .map((line, index) => `${String(index + 1).padStart(3)}| ${line}`)
              .join("\n")
          );
          reject(ex);
        } finally {
          session.close();
        }
      });
    }
    return stream
      .flatten()
      .bufferWithTimeOrCount(this.buffer.time, this.buffer.count)
      .filter(buf => buf.length)
      .flatMapConcat(events => {
        return kefir.fromPromise(transform(events));
      });
  }

  async clean() {
    const driver = await getDriver(this, { readOnly: false });
    const session = driver.session();
    try {
      await session.run(
        /* cypher */ `MATCH (n { __ns: $namespace}) DETACH DELETE n`,
        {
          namespace: getNamespace(this.models[0], this),
        }
      );
      await session.run(
        /* cypher */ `CREATE (s:SNAPSHOT { __ns: $namespace, __v: 0, __op: 0}) RETURN s`,
        {
          namespace: getNamespace(this.models[0], this),
        }
      );
    } finally {
      session.close();
      // console.log("closed");
    }
  }

  async dispose() {
    if (this.watch_timer) {
      clearInterval(this.watch_timer);
    }
    const driver = await getDriver(this, { readOnly: false });
    driver.close();
  }
};

const DRIVERS = new WeakMap();
const READONLY_DRIVERS = new WeakMap();

function getReadOnlyDriver(store) {
  if (READONLY_DRIVERS.has(store)) {
    return READONLY_DRIVERS.get(store);
  }

  const driver = augmentDriver(
    neo4j.driver(store.url, neo4j.auth.basic(store.user, store.password), {
      disableLosslessIntegers: true,
    }),
    getNamespace(store.models[0], store)
  );

  READONLY_DRIVERS.set(store, driver);

  return driver;
}

function getDriver(store, { readOnly = false }) {
  if (readOnly) {
    return getReadOnlyDriver(store);
  }

  if (DRIVERS.has(store)) {
    return DRIVERS.get(store);
  }

  const driver = neo4j.driver(
    store.url,
    neo4j.auth.basic(store.user, store.password),
    {
      disableLosslessIntegers: true,
    }
  );

  DRIVERS.set(store, driver);

  return driver;
}

const getNamespace = (model, store) =>
  `${store.name}::${model.name}_v${model.version}`;

function optimisticLocking(cmds, event, namespace) {
  return cmds.map((cmd, opIndex) => {
    const params = {
      type: event.type,
      payload: event.payload,
      meta: event.meta,
      upd: {
        __v: event.id,
        __op: opIndex,
        __ns: namespace,
      },
    };

    if (cmd.params) {
      Object.assign(params, cmd.params);
    }

    try {
      const transformedQuery = enhanceQuery(cmd.query);

      if (!transformedQuery) {
        console.error(`invalid query`, cmd.query);
      }

      const query = /* cypher */ `
MATCH (s:SNAPSHOT {__ns: $upd.__ns})
WHERE s.__v < $upd.__v OR (s.__v = $upd.__v AND s.__op < $upd.__op)
SET s += $upd
WITH s
${transformedQuery || "RETURN s"}
`;

      return [query, params];
    } catch (ex) {
      console.error(
        cmd.query
          .split("\n")
          .map((line, index) => `${String(index + 1).padStart(3)}| ${line}`)
          .join("\n")
      );
      console.error("%j", params);
      console.error(ex);
      throw ex;
    }
  });
}

const arrify = v => (Array.isArray(v) ? v : v == null ? [] : [v]);

const last = array => (array.length >= 1 ? array[array.length - 1] : null);
