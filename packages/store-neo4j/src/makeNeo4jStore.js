const createReadOnlyDriver = require("./createReadOnlyDriver");
const enhanceQuery = require("./cypher-transform-update");
const neo4j = require("neo4j-driver").default;
const interval = require("@async-generator/interval");

module.exports = async function makeNeo4jStore(config = {}) {
  const { name, model, url, user, password } = config;

  const lock = locker();
  let hasStopped = false;

  const ns = `${name}_v${model.version}`;

  const driver = neo4j.driver(url, neo4j.auth.basic(user, password), {
    disableLosslessIntegers: true,
  });

  const runSerial = makeRunner(driver, { ns });

  const store = {
    meta: {},
    name,
    registerModels,
    getDriver,
    handleEvents,
    getLastSeenId,
    listen,
    clean,
    toString() {
      return url;
    },
    dispose,
  };

  return store;

  async function getLastSeenId() {
    const [snapshot] = await runSerial([
      /* cypher */ `MERGE (s:SNAPSHOT { __ns: $ns}) ON CREATE SET s.__v = 0 RETURN s.__v as version`,
    ]);
    return snapshot.records[0] ? snapshot.records[0].get("version") : 0;
  }

  async function* listen() {
    // eslint-disable-next-line no-unused-vars
    for await (const _ of interval(300)) {
      yield await getLastSeenId();
    }
  }

  async function clean() {
    console.log("clean neo4j");
    await runSerial(
      [/* cypher */ `MATCH (n { __ns: $ns}) DETACH DELETE n`],
      [
        /* cypher */ `
        CREATE (s:SNAPSHOT { __ns: $ns, __v: 0, __op: 0})
        RETURN s;
        `,
      ],
    );
  }

  async function handleEvents(events) {
    if (hasStopped) return {};
    const release = lock();

    let stats = {
      nodesCreated: 0,
      nodesDeleted: 0,
      relationshipsCreated: 0,
      relationshipsDeleted: 0,
      propertiesSet: 0,
      labelsAdded: 0,
      labelsRemoved: 0,
      indexesAdded: 0,
      indexesRemoved: 0,
      constraintsAdded: 0,
      constraintsRemoved: 0,
    };

    const latestEventId = await getLastSeenId();

    try {
      const commands = [];

      for (const event of events) {
        if (event.id <= latestEventId) continue;
        const cmds = optimisticLocking(
          arrify(model.transform(event)),
          event,
          ns,
        );
        commands.push(...cmds);
      }

      if (!commands.length) {
        return {
          stats: {},
        };
      }

      const session = driver.session();
      let lastQueryForLoggingPurpose;

      try {
        await session.writeTransaction(async function (tx) {
          for (const cmd of commands) {
            const [query, params] = cmd;
            lastQueryForLoggingPurpose = query;
            const results = await tx.run(query, params);
            const updateStatistics = results.summary.updateStatistics;
            [
              "nodesCreated",
              "nodesDeleted",
              "relationshipsCreated",
              "relationshipsDeleted",
              "propertiesSet",
              "labelsAdded",
              "labelsRemoved",
              "indexesAdded",
              "indexesRemoved",
              "constraintsAdded",
              "constraintsRemoved",
            ].forEach((stat) => {
              stats[stat] += updateStatistics[stat];
            });
          }
        });
        return {
          stats: omitZero(stats),
        };
      } catch (ex) {
        console.error(ex.message);
        console.error(ex.code);
        console.error(
          lastQueryForLoggingPurpose
            .split("\n")
            .map((line, index) => `${String(index + 1).padStart(3)}| ${line}`)
            .join("\n"),
        );
        throw ex;
      } finally {
        session.close();
      }
    } finally {
      release();
    }
  }

  function registerModels(map) {
    map.set(model, store);

    // handle meta.includes
    const modelSpecificMeta = model.meta || model.transform.meta;
    if (
      !modelSpecificMeta ||
      !modelSpecificMeta.includes ||
      modelSpecificMeta.includes.length === 0
    ) {
      store.meta.includes = [];
    } else {
      store.meta.includes = modelSpecificMeta.includes;
    }
  }

  async function getDriver() {
    return createReadOnlyDriver(driver, ns);
  }

  async function dispose() {
    hasStopped = true;

    // tear down
    await driver.close();
  }
};

function makeRunner(driver, defaultParams) {
  return async function runSerial(...queries) {
    const session = driver.session();
    const results = [];
    try {
      for (const [query, params = {}] of queries) {
        const result = await session.run(
          query,
          Object.assign({}, defaultParams, params),
        );
        results.push(result);
      }

      return results;
    } finally {
      session.close();
    }
  };
}

function locker() {
  let on = false;

  return () => {
    if (on) {
      throw new Error("this function is locked and cannot run");
    }
    on = true;

    return () => {
      on = false;
    };
  };
}

const arrify = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

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
      const normalizedSpacing = cmd.query
        .split("\n")
        .map((row) => row.replace(/^\s*/, ""))
        .filter((row) => !row.startsWith("//"))
        .join("\n");
      const transformedQuery = enhanceQuery(normalizedSpacing);

      if (!transformedQuery) {
        console.error(`invalid query`, normalizedSpacing);
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
          .join("\n"),
      );
      console.error("%j", params);
      console.error(ex);
      throw ex;
    }
  });
}

const omitZero = (obj) => {
  const o = {};
  for (const key in obj) {
    if (obj[key]) {
      o[key] = obj[key];
    }
  }

  return o;
};
