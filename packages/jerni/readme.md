# jerni

[`jerni`](https://npm.im/jerni) is a nodejs library and a command-line tool to build an [opinionated](https://github.com/tungv/jerni) event-sourcing system.

## Resouces

1. [API documentation](https://docs.jerni.dev)
2. [List of Examples](https://github.com/tungv/jerni/tree/master/examples)

## Usage

```js
// journey.js
const createJourney = require("jerni");
const { makeStore } = require("@jerni/store-mongo");
const people = require("./models/people");

// this file needs to export an async initializer function that return a Promise of a journey
module.exports = async function() {
  const mongoStore = await makeStore({
    url: "mongodb://localhost:27017",
    dbName: "examples",
    models: [people],
  });

  const journey = createJourney({
    writeTo: "http://localhost:6181",
    stores: [mongoStore],
  });

  /* a journey provides
   * - journey.commit(): to publish an event
   * - journey.waitFor(): to get notified when an event is fully persisted from stores (destinations)
   * - journey.getReader(): to return a native driver for querying database, drivers are provided by the corresponding store
   * for more API documentations, please visit https://docs.jerni.dev
   */

  return journey;
};

// api.js
const journey = require("./journey.js");
const people = require("./models/people");
const { registerNewBorn, registerNewPerson } = require("./commands");

app.get("/api/people", async () => {
  const PeopleCollection = await journey.getReader(people);
  return People.find({});
});

app.post("/api/people", req => {
  // registerNewPerson will validate the request and commit approriate event to event queue
  return registerNewPerson(journey, req.body);
});

app.post("/api/births", req => {
  // registerNewBorn will validate the request and commit approriate event to event queue
  return registerNewBorn(journey, req.body);
});
```

## Subscription

To start a synchronization

```json
{
  "scripts": {
    "jerni-dev": "jerni-dev start ./journey.js",
    "jerni": "NODE_ENV=production jerni start ./journey.js"
  }
}
```

`jerni` and `jerni-dev` require node 10+ to run, while `@jerni/store-mongo` requires node 12. Therefore unless you're running node 12, you need to use these scripts:

```json
{
  "scripts": {
    "jerni-dev": "npx -p node@12 jerni-dev start ./journey.js",
    "jerni": "NODE_ENV=production npx -p node@12 jerni start ./journey.js"
  }
}
```

> adding `npx -p node@12` will run the following command in node 12 (`-p` is short for `--platform`)
