const ensureNamespace = require("./ensureNamespace");

module.exports = function augmentDriver(driver, namespace) {
  // console.log("augmentDriver(driver, '%s')", namespace);
  const augmentedDriver = new Proxy(driver, {
    get(target, prop, receiver) {
      if (prop === "session") {
        // console.log("[PROXY] driver.%s()", prop);
        return function(...args) {
          const session = target.session(...args);

          return trapSession(session, namespace);
        };
      } else {
        return Reflect.get(target, prop, receiver);
      }
    },
  });

  return augmentedDriver;
};

function trapTransaction(tx, namespace) {
  return new Proxy(tx, {
    get(target, prop, receiver) {
      if (prop === "run") {
        // console.log("[PROXY] transaction.run()");
        return function(query, ...args) {
          console.log("[PROXY] query:", query, ...args);
          console.log("[PROXY] augmented:", ensureNamespace(query, namespace));
          return target.run(ensureNamespace(query, namespace), ...args);
        };
      } else {
        return Reflect.get(target, prop, receiver);
      }
    },
  });
}

function trapSession(session, namespace) {
  return new Proxy(session, {
    get(target, prop, receiver) {
      if (prop === "writeTransaction") {
        throw new Error(
          "Neo4jStore(jerni): write operations [Session#writeTransaction] are forbidden on this read-only driver."
        );
      }
      if (prop === "run") {
        return async function run(query, params) {
          return target.run(ensureNamespace(query, namespace), params);
        };
      }

      if (prop === "beginTransaction") {
        // console.log("[PROXY] session.%s()", prop);
        return function(config) {
          const tx = target.beginTransaction(config);
          return trapTransaction(tx, namespace);
        };
      }

      if (prop === "readTransaction") {
        // console.log("[PROXY] session.%s()", prop);
        return function(work, config) {
          function trappedWork(tx) {
            return work.call(this, trapTransaction(tx, namespace));
          }

          return target.readTransaction(trappedWork, config);
        };
      } else {
        return Reflect.get(target, prop, receiver);
      }
    },
  });
}
