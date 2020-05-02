const pg = require("pg");
const uuid = require("@lukeed/uuid");
const subject = require("@async-generator/subject");
const bufferCountTime = require("@async-generator/buffer-time-count");
const createSubcriber = require("pg-listen");

/**
 * @typedef {Object} Event
 * @property {string!} id
 * @property {string!} type
 * @property {Object} payload
 * @property {Object} meta
 *
 * @typedef {Object} UncommittedEvent
 * @property {string!} type
 * @property {Object} payload
 * @property {Object} meta
 */

module.exports = function ({ ns: rawNs, connection }) {
  const ns = `heq-${rawNs}`;
  const CHANNEL_NAME = ns;
  const pool = new pg.Pool(connection);
  const subscriber = createSubcriber(connection);

  let terminated = false;

  /**
   * @namespace
   */
  const queue = { commit, generate, query, destroy, getLatest };

  let ensureSQLConditionSettingIsOn;

  async function sql(query, params) {
    if (terminated) return;

    if (typeof query === "string") {
      query = {
        text: query,
        values: params,
      };
    }

    query.ns = ns;

    const client = await pool.connect();
    // TODO: set a name for better query planing on Postgres server
    // @see https://node-postgres.com/features/queries
    try {
      return await client.query(query);
    } catch (ex) {
      console.error(ex);
      throw ex;
    } finally {
      client.release();
    }
  }

  return queue;

  /**
   *
   * @param {UncommittedEvent} event
   * @returns {Promise<Event>} committed event with numeric id
   */
  async function commit(event) {
    const id = uuid();
    const { type, payload = {}, meta = {} } = event;
    const resp = await sql(
      `SELECT write_message(
        $1::varchar,
        $2::varchar,
        $3::varchar,
        $4::jsonb,
        $5::jsonb
      );`,
      [id, ns, type, payload, meta],
    );

    const {
      rows: [{ write_message: idFromZero }],
    } = resp;

    const committed = {
      id: parseInt(idFromZero) + 1,
      type,
      payload,
      meta,
    };
    subscriber.notify(CHANNEL_NAME, committed);

    return committed;
  }

  /**
   * @typedef {Object} PrivateQueryAllFromTo
   * @property {number} from
   * @property {number} to
   *
   * @typedef {Object} PrivateQueryAllFromMax
   * @property {number} from
   * @property {number} max
   *
   * @param {(PrivateQueryAllFromMax|PrivateQueryAllFromTo)} config
   */
  async function _queryAll({ from, to, max }) {
    const actualSize = max || to - from;
    const { rows } = await sql({
      name: "get_all_types",
      text: `
SELECT
  (s.msg).type,
  (s.msg).position::int + 1 as id,
  (s.msg).data::jsonb as payload,
  (s.msg).metadata::jsonb as meta
FROM (
  SELECT get_stream_messages($1::varchar, $2::bigint, $3::bigint) as msg
) AS s`,
      values: [ns, from, actualSize],
    });
    return rows;
  }

  /**
   * @typedef {Object} PrivateQueryWithTypesFromTo
   * @property {number} from
   * @property {number} to
   * @property {string[]} types
   *
   * @typedef {Object} PrivateQueryWithTypesFromMax
   * @property {number} from
   * @property {number} max
   * @property {string[]} types
   *
   * @param {(PrivateQueryWithTypesFromTo|PrivateQueryWithTypesFromMax)} config
   */
  async function _queryByTypes({ from, to, max, types }) {
    if (!ensureSQLConditionSettingIsOn) {
      ensureSQLConditionSettingIsOn = sql(
        `SET message_store.sql_condition TO TRUE`,
      );
    }

    const actualSize = max || to - from;
    const conditions = [
      max ? "1 = 1" : `messages.position <= ${to - 1}`,
      `messages.type IN ('${types.join("', '")}')`,
    ];

    await ensureSQLConditionSettingIsOn;
    const { rows } = await sql({
      name: "get_certain_types",
      text: `
SELECT
  (s.msg).type,
  (s.msg).position::int + 1 as id,
  (s.msg).data::jsonb as payload,
  (s.msg).metadata::jsonb as meta
FROM (
  SELECT get_stream_messages($1::varchar, $2::bigint, $3::bigint, $4::varchar) as msg
) AS s`,
      values: [ns, from, actualSize, conditions.join(" AND ")],
    });

    return rows;
  }

  /**
   * @typedef {Object} QueryConfig
   * @property {number} from
   * @property {number} to
   * @property {Array<string>} types
   *
   * @param {QueryConfig} queryConfig
   * @returns {Promise<Event[]>}
   */
  async function query({ from = -1, to, types = [] }) {
    return types.length === 0
      ? await _queryAll({ from, to })
      : await _queryByTypes({ from, to, types });
  }

  /**
   * @generator
   * @param {number} from last seen id from client
   * @param {number} max maximum number of events to receive
   * @param {number} time maximum wait time before another yield
   * @param {string[]} types array of event types to include
   *
   * @returns {AsyncGenerator<Event[]>} a batch of events retrieved from queue
   */
  async function* generate(from, max, time, types = []) {
    const buffer = [];
    const [stream, __emit, end] = subject(buffer);
    let aborted = false;
    let $ = defer();
    $.resolve();

    let hasEmitted = 0;

    function emit(event) {
      if (hasEmitted >= event.id) return;
      __emit(event);
      hasEmitted = event.id;
      // console.log("emitted", event.id);
    }

    await subscriber.connect();
    await subscriber.listenTo(CHANNEL_NAME);

    function subscription(event) {
      //
      // console.log(event);
      emit(event);
    }

    (async function () {
      let start = from;
      while (!aborted) {
        await $.promise;

        const batch =
          types.length === 0
            ? await _queryAll({ from: start, max })
            : await _queryByTypes({ from: start, max, types });

        if (batch.length === 0) {
          subscriber.notifications.on(CHANNEL_NAME, subscription);
          // await sleep(time);
          // continue;
          break;
        }

        const lastInBatch = last(batch);
        start = lastInBatch.id;
        batch.forEach(emit);
        subscriber.notifications.off(CHANNEL_NAME, subscription);
      }
    })();

    const buffered = bufferCountTime(stream, time, max);

    try {
      for await (const batch of buffered) {
        if (batch.length !== 0) {
          $ = defer();
          yield batch;
          $.resolve();
        }
      }
    } finally {
      subscriber.notifications.off(CHANNEL_NAME, subscription);
      aborted = true;
      end();
    }
  }

  /**
   * tear down all resources
   *
   * @returns {Promise<void>}
   */
  async function destroy() {
    // tear down
    terminated = true;
    await pool.end();
    await subscriber.close();
  }

  /**
   * @return {Promise<Event>}
   */
  async function getLatest() {
    // @see: https://www.postgresql.org/docs/9.3/rowtypes.html#ROWTYPES-ACCESSING
    const resp = await sql(
      `
    SELECT
      (s.msg).type,
      (s.msg).position::int + 1 as id,
      (s.msg).data::jsonb as payload,
      (s.msg).metadata::jsonb as meta
    FROM (
      SELECT get_last_stream_message($1::varchar) as msg
    ) AS s`,
      [ns],
    );
    const event = resp.rows[0];

    return event;
  }
};

/**
 *
 * @template T
 * @param {Array<T>} array
 * @returns {?T} item type
 */
const last = (array) => (array.length >= 1 ? array[array.length - 1] : null);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
