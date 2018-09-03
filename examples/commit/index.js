const { json } = require("micro");
const { router, get, post } = require("microrouter");
const nanoid = require("nanoid");

const accounts = require("./models/accounts");
const journey = require("./journey");

const service = router(
  get("/users", async req => {
    const Accounts = await journey.getReader(accounts);
    return Accounts.find({}).toArray();
  }),
  post("/users", async req => {
    const id = nanoid();
    const body = await json(req);

    const event = await journey.commit({
      type: "ACCOUNT_OPENED",
      payload: {
        id,
        name: body.name
      }
    });

    await journey.waitFor(event);
    const Accounts = await journey.getReader(accounts);

    return Accounts.findOne({ id });
  })
);

module.exports = service;
