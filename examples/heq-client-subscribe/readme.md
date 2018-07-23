# subscription example

This example demonstrates how CQRS works with `heq`. In contrast to traditional approaches where read
and write operations are often be carried out using a single data access layer, CQRS is a database
access model where we use one data model to write and another one to read. With `heq` ecosystem in mind, write-side model is an append-only events log, while read-side can be any type of traditional database
ranging from MySQL to MongoDB or Neo4J or even cloud-based services like firebase.

To "connect" two data models, we need some method of transferring data from the write-side to the
read-side. [`heq-client`](https://npm.im/heq-client) is a CLI command to do that by keeping
read-side database up-to-date by accumulating changes from write-side events log.

`heq-client` takes a configuration file (written in JavaScript) and starts a worker that subscribes
to an `heq-server` instance and dispatches database operations (INSERT, UPDATE, DELETE) based on
a set of predefine rules. It's also designed to ensure those operations are idempotent using an
optimistic locking mechanism.

Given a remote `heq-server` instance running on `https://events.tung.ninja` and a local mongodb
running on `mongodb://localhost:27017/heq-example`, `heq-client` will receive unprocessed events from
`heq-server` and dispatch mongodb operations to the aforementioned database.

# get started
