const mapEvents = require("jerni/mapEvents");
const { Model } = require("@jerni/store-mongo");

module.exports = new Model({
  name: "people",
  version: "1.0.0",
  transform: mapEvents({
    PERSON_REGISTERED: event => ({
      insertOne: {
        id: event.payload.id,
        full_name: event.payload.name,
        born_at: event.payload.born_at
      }
    }),

    CHILDREN_BORN: ({ payload: { children, parents }, meta }) => [
      {
        insertMany: children.map(child => ({
          id: child.id,
          full_name: child.name,
          born_at: meta.occurred_at
        }))
      },
      {
        updateMany: {
          where: { id: { $in: [parents] } },
          changes: {
            $push: {
              children: {
                $each: children.map(child => child.id)
              }
            }
          }
        }
      }
    ]
  })
});
