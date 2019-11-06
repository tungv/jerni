const micro = require("micro");
const crypto = require("crypto");
const fs = require("fs");
const factory = require("heq-server");
const { watch } = require("chokidar");

module.exports = async function makeFileSystemServer({ port, dataPath }) {
  const [queue, onceModified] = await makeFileSystemQueue(dataPath);

  const config = {
    queue,
  };

  const service = await factory(config);
  const server = micro(service);

  return new Promise((resolve, reject) => {
    server.listen(port, err => {
      if (!err) {
        resolve([server, onceModified]);
        return;
      }

      reject(err);
    });
  });
};

async function makeFileSystemQueue(dataPath) {
  const restart$ = defer();
  let data = "";

  try {
    data = String(fs.readFileSync(dataPath));
  } catch (err) {
    if (err.code === "ENOENT") {
      data = "";
      // fs.writeFileSync(dataPath, '{"id":0,"type":"@@INIT","payload":{}}');
    }
  }
  let id = data.split("\n").length;
  let lastCheck = checksum(data);

  const events = data
    ? data
        .split("\n")
        .filter(x => x)
        .map(json => JSON.parse(json))
    : [];

  const watcher = watch([dataPath]);

  watcher.on("change", () => {
    let data = String(fs.readFileSync(dataPath));
    if (checksum(data) !== lastCheck) {
      console.log("on change", lastCheck, checksum(data));
      restart$.resolve();
    }
  });

  function commit(event) {
    console.log("commit", event);
    event.id = id++;

    data += JSON.stringify(event) + "\n";
    lastCheck = checksum(data);
    fs.writeFileSync(dataPath, data);
    events.push(event);
    return event;
  }

  const query = ({ from, to = id }) => {
    return events.slice(from, to);
  };

  const getLatest = () =>
    events.length === 0 ? { id: 0, type: "@@INIT" } : events[events.length - 1];

  async function* generate(from, max, time, includingTypes = []) {
    console.log("generate", { from, max, time, includingTypes });
    const buffer = [];
    let i = from;

    const filter = includingTypes.length
      ? event => includingTypes.includes(event.type)
      : alwaysTrue;

    try {
      while (true) {
        await sleep(time);
        for (; i < events.length; ++i) {
          const event = events[i];
          if (filter(event)) {
            buffer.push(event);

            if (buffer.length >= max) {
              yield buffer;
              buffer.length = 0;
            }
          }
        }
        if (buffer.length > 0) {
          yield buffer;
        }
        buffer.length = 0;
      }
    } catch (ex) {
      console.error(ex);
    } finally {
      console.log("cancel");
    }
  }

  function DEV__getDriver() {
    return {
      clear() {
        events.length = 0;
      },
    };
  }

  return [
    { commit, query, getLatest, generate, DEV__getDriver },
    restart$.promise,
  ];
}

function checksum(str, algorithm, encoding) {
  return crypto
    .createHash(algorithm || "md5")
    .update(str, "utf8")
    .digest(encoding || "hex");
}

function defer() {
  let resolve, reject;

  const promise = new Promise((_1, _2) => {
    resolve = _1;
    reject = _2;
  });
  return {
    promise,
    resolve,
    reject,
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const alwaysTrue = () => true;
