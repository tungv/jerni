const ensureNamespace = require("./ensureNamespace");
const neo4j = require("neo4j-driver").default;

function trapTransaction(tx, ns) {
  return new Proxy(tx, {
    get(target, prop, receiver) {
      if (prop === "run") {
        // console.log("[PROXY] transaction.run()", target);
        return function (query, ...args) {
          // console.log("[PROXY] query:", query, ...args);
          return target.run(ensureNamespace(query, ns), ...args);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function trapSession(session, ns, useRx) {
  return new Proxy(session, {
    get(target, prop, receiver) {
      if (prop === "beginTransaction") {
        // console.log("[PROXY] session.%s()", prop);
        return function (config) {
          const tx = target.beginTransaction(config);

          if (useRx) {
            const err = new Error(
              "@jerni/store-neo4j does NOT support RxSession#beginTransaction()",
            );
            err.name = "StoreNeo4jError";
            throw err;
          }

          return trapTransaction(tx, ns);
        };
      }

      if (prop === "readTransaction") {
        // console.log("[PROXY] session.%s()", prop);
        return function (work, config) {
          function trappedWork(tx) {
            return work.call(this, trapTransaction(tx, ns));
          }

          return target.readTransaction(trappedWork, config);
        };
      }
      if (prop === "writeTransaction") {
        // console.log("[PROXY] session.%s()", prop);
        const error = new Error(
          "starting a WRITE transaction on a read-only driver is not allowed",
        );
        error.name = "StoreNeo4jError";
        throw error;
      }

      if (prop === "run") {
        return function (query, ...args) {
          // console.log("[PROXY] query:", query, ...args);
          return target.run(ensureNamespace(query, ns), ...args);
        };
      }

      // console.log("[PROXY] session.%s()", prop);
      return Reflect.get(target, prop, receiver);
    },
  });
}

module.exports = async function createReadOnlyDriver(driver, ns) {
  const readOnlyDriver = new Proxy(driver, {
    get(target, prop, receiver) {
      if (prop === "session" || prop === "rxSession") {
        // console.log("[PROXY] driver.%s()", prop);
        return function (opts) {
          if (opts && opts.defaultAccessMode === neo4j.session.WRITE) {
            const error = new Error(
              "creating a session with WRITE persmission is not allowed",
            );
            error.name = "StoreNeo4jError";
            throw error;
          }
          const session = target[prop](opts);

          return trapSession(session, ns, prop === "rxSession");
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });

  return readOnlyDriver;
};
