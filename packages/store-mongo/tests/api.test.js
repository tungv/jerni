const is = require("@sindresorhus/is");
const test = require("ava");

const Store = require("../Store");

test("Store should implement base class", t => {
  const { prototype } = Store;

  t.true(is.function(prototype.getDriver));
  t.true(is.function(prototype.subscribe));
  t.true(is.asyncFunction(prototype.receive));
  t.true(is.asyncFunction(prototype.getLastSeenId));
});
