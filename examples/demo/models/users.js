const Model = require("@jerni/store-mongo/Model");
const mapEvents = require("jerni/lib/mapEvents");

module.exports = new Model({
  name: "users",
  version: "1",
  transform: mapEvents({
    "USER:REGISTERED"(event) {
      return {
        insertOne: {
          email: event.payload.email,
          fullName: event.payload.fullname,
        },
      };
    },
  }),
});
