## Example

```js
// store.js
const { initStore } = require('heq-client');

const mongoDBConfig = {
  url: 'mongodb://localhost:27017',
  dbName: 'examples',
};

const store = initStore({
  writeTo: 'https://events.tung.ninja',
  readFrom: [people.connect(mongoDBConfig)],
});

module.exports = store;

// api.js
const store = require('./store.js');
const people = require('./models/people');
const { registerNewBorn, registerNewPerson } = require('./commands');

app.get('/api/people', async () => {
  const PeopleCollection = await store.read(people);
  return People.find({});
});

app.post('/api/people', req => {
  return registerNewPerson(store, req.body);
});

app.post('/api/births', req => {
  return registerNewBorn(store, req.body);
});
```

## Subscription

```json
{
  "scripts": {
    "subscribe:dev": "heq-client ./store.js --watch=./models",
    "subscribe": "NODE_ENV=production heq-client"
  }
}
```
