const adapter = require("../src");

test("it should commit", async () => {
  const queue = adapter({
    ns: "test_commit",
    host: "localhost",
    port: "54320",
    password: "simple",
  });

  const event = await queue.commit({ type: "test_1", payload: { a: "b" } });

  expect(event).toEqual({ id: 1, type: "test_1", payload: { a: "b" } });
});
