# @jerni/store-mongo

Transform events provided by [`jerni`](https://npm.im/jerni) and persist the output to a MongoDB Database.

## Installation

```
> npm i jerni @jerni/store-mongo
```

or, for yarn user

```
> yarn add jerni @jerni/store-mongo
```

## Usage

> Before you start, please make yourself comfortable with the concept of [`jerni` architecture](https://github.com/tungv/jerni)

Create a JavaScript file as follow (given it's located at `src/journey.js`)

```js
// src/journey.js
const createJourney = require("jerni");
const { makeStore } = require("@jerni/store-mongo");

// an example journey initializer
// for more examples, please visit: https://github.com/tungv/jerni/tree/master/examples
// for API documentations: please visit: https://docs.jerni.dev
module.exports = async function() {
  const mongoStore = await makeStore({
    name: "your store name",
    url: "mongodb://<...hostname...>:<...port...>",
    dbName: "database name",
    models: [
      collection1, // see more about models below
      collection2,
    ],
  });

  // at this point, mongoStore is ready to use

  const journey = createJourney({
    writeTo: "http://localhost:6181",
    stores: [store],
  });

  return journey;
};
```
