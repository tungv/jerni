// store.js
const initStore = require('heq-store');
const { Connection } = require('@heq/store-mongo');
const people = require('./models/people');

const mongoSource = new Connection({
  name: 'mongodb',
  url: 'mongodb://localhost:27017',
  dbName: 'examples',
  models: [people],
});

const store = initStore({
  writeTo: 'https://events.tung.ninja',
  readFrom: [mongoSource],
});

module.exports = store;
