module.exports = function () {
  const queue = { commit, generate, query, destroy, getLatest };

  return queue;

  async function commit(event) {
    return event;
  }

  async function query({ from = -1, to, types = [] }) {
    return [];
  }
};
