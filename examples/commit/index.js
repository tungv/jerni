const { json } = require("micro");
const { router, get, post, del } = require("microrouter");
const nanoid = require("nanoid");

const accounts = require("./models/accounts");
const journey = require("./journey");

const service = router(
  get("/accounts", async req => {
    const Accounts = await journey.getReader(accounts);
    return Accounts.find({}).toArray();
  }),
  post("/accounts", async req => {
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
  }),
  del("/accounts/:id", async req => {
    const Accounts = await journey.getReader(accounts);

    const removingAccount = await Accounts.findOne({ id: req.params.id });
    if (!removingAccount) {
      throw createError(404, "account not found");
    }

    await journey.commit({
      type: "ACCOUNT_CLOSED",
      payload: { id: req.params.id }
    });

    return null;
  })
);

module.exports = service;
