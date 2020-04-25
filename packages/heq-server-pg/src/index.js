const { Pool } = require("pg");
const uuid = require("@lukeed/uuid");

module.exports = function ({ ns, connection }) {
  const pool = new Pool(connection);

  const queue = { commit, generate, query, destroy, getLatest };

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

  async function query({ from = -1, to, types = [] }) {
    return [];
  }

  async function* generate() {
    yield 1;
  }

  async function destroy() {
    // tear down
    console.time("destroyed");
    await pool.end();
    console.timeEnd("destroyed");
  }

  async function getLatest() {
    return {};
  }
};
