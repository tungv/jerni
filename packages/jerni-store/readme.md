## Example

```js
// store.js
const { initStore } = require("jerni-store");
const { Connection } = require("@jerni/store-mongo");
const people = require("./models/people");

const mongoSource = new Connection({
  url: "mongodb://localhost:27017",
  dbName: "examples",
  models: [people]
});

const store = initStore({
  writeTo: "https://events.tung.ninja",
  readFrom: [mongoSource]
});

module.exports = store;

// api.js
const store = require("./store.js");
const people = require("./models/people");
const { registerNewBorn, registerNewPerson } = require("./commands");

app.get("/api/people", async () => {
  const PeopleCollection = await store.getReader(people);
  return People.find({});
});

app.post("/api/people", req => {
  return registerNewPerson(store, req.body);
});

app.post("/api/births", req => {
  return registerNewBorn(store, req.body);
});
```

## Subscription

```json
{
  "scripts": {
    "subscribe:dev": "jerni-store ./store.js --watch=./models",
    "subscribe": "NODE_ENV=production jerni-store"
  }
}
```
