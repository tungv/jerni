# Bank accounts example

This example will evolve over time to demonstrate the ease of development when requirements are not clear at the beginning

# Get started

```sh
# install dependencies
$ yarn

# start hot-reloadable api server (powered by micro-dev)
$ yarn dev-api

# in a different terminal session.
# start hot-reloadable jerni-dev server (which is also a subscriber)
$ yarn dev-jerni
```

# APIs

current APIs include:

1.  `GET /accounts`
2.  `POST /accounts { name: String! }`
3.  `DELETE /accounts/:account_id`
4.  `POST /deposits { receiver: String!, amount: Number! }`
5.  `POST /transactions { sender: String!, receiver: String!, amount: Number! }`

# Hot reload

`jerni-dev` takes hot reloading to another level. Conventional tooling usually give you the ability to reload API code for new requests. However, with `jerni-dev`, past requests that changed databases will also got hot-replayed as if the database logic was built correctly from the beginning.

Try to go edit `./models/accounts` and call `GET /accounts` to see how updated logic applies on past requests.

# Time travel

`jerni-dev` give you another ultimate weapon for debugging while in development mode, the Time Travel™ debugger.

```sh
# try to close yarn dev-jerni command and run

$ yarn dev-jerni --open
```

The command will now open a new tab in your favorite browser listing all happened events in reverse chronological order (newest event is on top). Click on (x) next to an event title to remove it from the "history". Your database will automatically replayed every event but the ones that are excluded.

![devtool-UI](./devtool-ui.png)
