## Example

```js
// journey.js
const createJourney = require("jerni");
const { Store } = require("@jerni/store-mongo");
const people = require("./models/people");

const mongoStore = new Store({
  url: "mongodb://localhost:27017",
  dbName: "examples",
  models: [people]
});

const journey = createJourney({
  writeTo: "https://events.jerni.app",
  stores: [mongoStore]
});

module.exports = journey;

// api.js
const journey = require("./journey.js");
const people = require("./models/people");
const { registerNewBorn, registerNewPerson } = require("./commands");

app.get("/api/people", async () => {
  const PeopleCollection = await journey.getReader(people);
  return People.find({});
});

app.post("/api/people", req => {
  return registerNewPerson(journey, req.body);
});

app.post("/api/births", req => {
  return registerNewBorn(journey, req.body);
});
```

## Subscription

```json
{
  "scripts": {
    "subscribe:dev": "jerni-journey ./journey.js --watch=./models",
    "subscribe": "NODE_ENV=production jerni-journey"
  }
}
```
