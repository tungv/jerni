const got = require("got");
module.exports = async function commitSomething({ port }) {
  const { body } = await got(`http://localhost:${port}/commit`, {
    json: true,
    body: {
      type: "TEST",
      payload: {
        key: "value",
      },
    },
  });

  return body;
};
