const Model = require("@jerni/store-mongo/Model");
const mapEvents = require("jerni/lib/mapEvents");

module.exports = new Model({
  name: "users",
  version: "1",
  transform: mapEvents({
    USER_REGISTERED(event) {
      return {
        insertOne: {
          id: event.payload.id,
          email: event.payload.email,
          fullName: event.payload.fullName,
        },
      };
    },
  }),
});
