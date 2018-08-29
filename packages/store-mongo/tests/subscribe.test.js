const kefir = require("kefir");
const test = require("ava");

const Model = require("../Model");
const Store = require("../Store");

const makeStream = array => kefir.sequentially(10, array);
const { MONGODB = "mongodb://localhost:27017" } = process.env;

test.cb("subscribe", t => {
  const incomingBatchedEvents = [
    [{ id: 1 }, { id: 2 }],
    [{ id: 3 }, { id: 4 }],
    [{ id: 5 }, { id: 6 }]
  ];
  const stream = makeStream(incomingBatchedEvents);

  const model1 = new Model({
    name: "collection_1",
    version: "abc",
    transform: event => [{ insertOne: event }]
  });

  const model2 = new Model({
    name: "collection_2",
    version: "1.2.3",
    transform: event => [{ insertOne: { x: 1 } }]
  });

  const conn = new Store({
    url: MONGODB,
    dbName: "test_transform",
    models: [model1, model2]
  });

  let subscription;

  conn
    .clean()
    .then(() => conn.getDriver(model1))
    .then(coll => coll.countDocuments({}))
    .then(count => {
      t.is(count, 0);

      conn.subscribe(async id => {
        if (id === 6) {
          const coll = await conn.getDriver(model1);

          const items = await coll.find({}).toArray();
          t.is(items.length, 6);
          t.deepEqual(items.map(item => item.id), [1, 2, 3, 4, 5, 6]);
          subscription.unsubscribe();
          t.end();
        }
      });

      conn.receive(stream).then(outputStream => {
        subscription = outputStream.observe();
      });
    });
});
