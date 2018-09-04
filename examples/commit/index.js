const { createError, json } = require("micro");
const { router, get, post, del } = require("microrouter");
const nanoid = require("nanoid");

const accounts = require("./models/accounts");
const journey = require("./journey");

const getAccountOr404 = async id => {
  const Accounts = await journey.getReader(accounts);

  const account = await Accounts.findOne({ id });
  if (!account) {
    throw createError(404, "account not found");
  }

  return account;
};

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
    const removingAccount = await getAccountOr404(req.params.id);

    await journey.commit({
      type: "ACCOUNT_CLOSED",
      payload: { id: req.params.id }
    });

    // 204
    return null;
  }),
  post("/deposits", async req => {
    const body = await json(req);
    if (typeof body.amount !== "number" && body.amount <= 0) {
      throw createError(422, "invalid amount");
    }
    const receiver = await getAccountOr404(body.receiver);
    await journey.commit({
      type: "DEPOSITED",
      payload: {
        receiver: receiver.id,
        amount: body.amount
      }
    });

    return body;
  }),
  post("/transactions", async req => {
    const body = await json(req);
    const id = nanoid();
    if (typeof body.amount !== "number" && body.amount <= 0) {
      throw createError(422, "invalid amount");
    }

    const receiver = await getAccountOr404(body.receiver);
    const sender = await getAccountOr404(body.sender);

    // side-effect: this is not race-condition-free, just try to reduce the chance of race conditions
    if (sender.usable_balance < body.amount) {
      throw createError(422, "sender does not have sufficient fund");
    }

    const trxMadeEvent = await journey.commit({
      type: "TRANSACTION_MADE",
      payload: {
        id,
        from: sender.id,
        to: receiver.id,
        amount: body.amount
      }
    });

    await journey.waitFor(trxMadeEvent);

    const senderAfter = await getAccountOr404(body.sender);
    if (senderAfter.balance < 0) {
      const trxRevertedEvent = await journey.commit({
        type: "TRANSACTION_REVERTED",
        payload: {
          id,
          from: sender.id,
          to: receiver.id,
          amount: body.amount
        }
      });

      await journey.waitFor(trxRevertedEvent);

      throw createError(422, "sender does not have sufficient fund");
    }

    const trxCommittedEvent = await journey.commit({
      type: "TRANSACTION_COMMITTED",
      payload: {
        id,
        from: sender.id,
        to: receiver.id,
        amount: body.amount
      }
    });

    await journey.waitFor(trxCommittedEvent);

    return {
      id,
      from: sender.id,
      to: receiver.id,
      amount: body.amount
    };
  })
);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = service;
