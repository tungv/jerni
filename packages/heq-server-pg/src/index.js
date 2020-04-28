const pg = require("pg");
const uuid = require("@lukeed/uuid");

module.exports = function ({ ns: rawNs, connection }) {
  const ns = `heq-${rawNs}`;
  const pool = new pg.Pool(connection);

  const queue = { commit, generate, query, destroy, getLatest };

  let ensureSQLConditionSettingIsOn;

  async function sql(query, params) {
    const client = await pool.connect();
    // TODO: set a name for better query planing on Postgres server
    // @see https://node-postgres.com/features/queries
    try {
      return await client.query(query, params);
    } catch (ex) {
      console.error(ex);
      throw ex;
    } finally {
      client.release();
    }
  }

  return queue;

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

    return {
      id: parseInt(idFromZero) + 1,
      type,
      payload,
      meta,
    };
  }

  async function _queryAll(from, to) {
    const { rows } = await sql({
      text: `
SELECT
  (s.msg).type,
  (s.msg).position::int + 1 as id,
  (s.msg).data::jsonb as payload,
  (s.msg).metadata::jsonb as meta
FROM (
  SELECT get_stream_messages($1::varchar, $2::bigint, $3::bigint) as msg
) AS s`,
      values: [ns, from, to - from],
    });
    return rows;
  }

  async function _queryByTypes(from, to, types) {
    if (!ensureSQLConditionSettingIsOn) {
      ensureSQLConditionSettingIsOn = sql(
        `SET message_store.sql_condition TO TRUE`,
      );
    }

    await ensureSQLConditionSettingIsOn;
    const { rows } = await sql({
      text: `
SELECT
  (s.msg).type,
  (s.msg).position::int + 1 as id,
  (s.msg).data::jsonb as payload,
  (s.msg).metadata::jsonb as meta
FROM (
  SELECT get_stream_messages($1::varchar, $2::bigint, $3::bigint, $4::varchar) as msg
) AS s`,
      values: [
        ns,
        from,
        to - from,
        `messages.position <= ${to - 1} AND messages.type IN ('${types.join(
          "', '",
        )}')`,
      ],
    });

    return rows;
  }

  async function query({ from = -1, to, types = [] }) {
    return types.length === 0
      ? await _queryAll(from, to)
      : await _queryByTypes(from, to, types);
  }

  async function* generate(from, max, time, includingTypes = []) {
    let start = from;

    while (true) {
      const batch = await query({
        from: start,
        to: start + max,
        types: includingTypes,
      });
      const lastInBatch = last(batch);

      start = lastInBatch.id;
      yield batch;
    }
  }

  async function destroy() {
    // tear down
    await pool.end();
  }

  /**
   * @typedef {Object} Event
   * @property {string} id
   * @property {string} type
   * @property {Object} payload
   * @property {Object} meta
   *
   * @return {Event}
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

const last = (array) => (array.length >= 1 ? array[array.length - 1] : null);
