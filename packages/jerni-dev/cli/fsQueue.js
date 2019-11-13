const parseJson = require("json-parse-better-errors");
const hash = require("object-hash");
const fs = require("fs");
const getLogger = require("./dev-logger");
const INITIAL_EVENT = { type: "@@INIT" };
const initialChecksum = hash.MD5(INITIAL_EVENT);

exports.checksumFile = function checksumFile(filePath) {
  const logger = getLogger({ service: "queue", verbose: true });

  if (!fs.existsSync(filePath)) {
    logger.info("creating new data file");
    fs.writeFileSync(filePath, `### BEGIN checksum: ${initialChecksum} ###`);
    return [initialChecksum, initialChecksum, []];
  }

  const data = String(fs.readFileSync(filePath));
  const rows = data.length ? data.split("\n") : [];
  const events = [];

  if (!rows[0] || !rows[0].length) {
    logger.info("data file is empty");
    fs.writeFileSync(filePath, `### BEGIN checksum: ${initialChecksum} ###`);
    return [initialChecksum, "", []];
  }

  const checksumMatch = rows[0].match(/### BEGIN checksum: (\w{32}) ###/);

  if (!checksumMatch) {
    throw new Error("invalid banner");
  }

  const checksum = checksumMatch[1];

  let lastHash = initialChecksum;

  for (let i = 0; i < rows.length; ++i) {
    // skip non data rows
    if (!rows[i].startsWith('{"')) continue;

    try {
      const event = parseJson(rows[i]);
      events.push(event);
      const calculatedChecksum = hash.MD5({ event, lastHash });
      lastHash = calculatedChecksum;
    } catch (ex) {
      logger.error("JSON data corrupted at line: %d\n%s", i + 1, ex.message);
      throw new Error("Cannot parse data file");
    }
  }

  return [lastHash, checksum, events];
};

exports.makeQueue = async function(dataPath, verbose) {
  const logger = getLogger({ service: "queue", verbose });
  // parse raw data
  const [current, , events] = exports.checksumFile(dataPath);

  let id = events.length;
  let lastHash = current;

  return { commit, query, getLatest, generate };

  function commit(event) {
    const nextChecksum = hash.MD5({
      event,
      lastHash,
    });

    // clone
    const finalEvent = { ...event };
    lastHash = nextChecksum;
    logger.debug("checksum: %s", nextChecksum);
    const json = JSON.stringify(finalEvent);
    events.push(finalEvent);

    fs.appendFileSync(dataPath, "\n" + json, "utf8");
    writeChecksum(nextChecksum);

    finalEvent.id = ++id;
    return finalEvent;
  }

  function query({ from, to = id }) {
    logger.log("query", { from, to });
    return events.slice(from, to);
  }

  function getLatest() {
    return last(events) || INITIAL_EVENT;
  }

  async function* generate(from, max) {
    const time = 300;
    const buffer = [];
    let i = from;

    while (true) {
      await sleep(time);
      for (; i < id; ++i) {
        const event = events[i];
        buffer.push({ ...event, id: i + 1 });

        if (buffer.length >= max) {
          yield buffer;
          buffer.length = 0;
        }
      }

      if (buffer.length > 0) {
        yield buffer;
        buffer.length = 0;
      }
    }
  }

  function writeChecksum(checksum) {
    exports.writeChecksum(dataPath, checksum);
  }
};

exports.writeChecksum = function(dataPath, checksum) {
  const fd = fs.openSync(dataPath, "a");
  const buffer = `### BEGIN checksum: ${checksum} ###`;
  try {
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const last = array => (array.length >= 1 ? array[array.length - 1] : null);
