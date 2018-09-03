const mapEvents = require("jerni/lib/mapEvents");
const { Model } = require("@jerni/store-mongo");

module.exports = new Model({
  name: "accounts",
  version: "1.0.0",
  transform: mapEvents({
    ACCOUNT_OPENED: event => ({
      insertOne: {
        id: event.payload.id,
        full_name: event.payload.name,
        balance: 0
      }
    }),

    ACCOUNT_CLOSED: event => ({
      removeOne: {
        where: {
          id: event.payload.id
        }
      }
    })
  })
});
