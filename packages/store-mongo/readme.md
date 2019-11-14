# @jerni/store-mongo

Synchronize events from your [`heq` server](https://npm.im/heq) to MongoDB

## Installation

```
> npm i jerni @jerni/store-mongo
```

## Usage

> Before you start, please make yourself comfortable with the concept of [`heq` server](https://npm.im/heq)

Create a JavaScript file as follow (given it's located at `src/journey.js`)

```js
// src/journey.js
const createJourney = require("jerni");
const makeMongoStore = require("@jerni/store-mongo/makeStore");

module.exports = async function initial() {
  const mongoStore = await makeMongoStore({
    name: "your store name",
    url: "mongodb://<...hostname...>:<...port...>",
    dbName: "database name",
    models: [
      collection1, // see more about models below
      collection2,
    ],
    dev: process.env.NODE_ENV !== "production",
  });

  const journey = createJourney({
    writeTo: "<your heq server address>",
    stores: [store],
  });

  return journey;
};
```

Start your synchronization job:

```
# start job and open a report endpoint at http://localhost:4000
# change --http=<port number> to mount it to a different port
# change --interval=<milliseconds> to change refresh rate of the report
npx jerni src/journey.js --http=4000 --interval=5000
```
