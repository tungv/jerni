const got = require("got");

const DEFAULT_BODY = {
  type: "TEST",
  payload: {
    key: "value",
  },
};

module.exports = async function commitSomething({
  port,
  reqBody = DEFAULT_BODY,
}) {
  const { body } = await got(`http://localhost:${port}/commit`, {
    json: true,
    body: reqBody,
  });

  return body;
};
