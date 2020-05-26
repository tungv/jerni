const ensureNamespace = require("./ensureNamespace");

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
        return function (...args) {
          const session = target[prop](...args);

          return trapSession(session, ns, prop === "rxSession");
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });

  return readOnlyDriver;
};
