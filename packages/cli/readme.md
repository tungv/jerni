# event.js

```
> npx heq
```

## Custom configuration

you can specify a config file, which is a JavaScript file that exports a configuration object

```
> npx heq --redis=redis://localhost:6379 --redis-namespace=sample --port=9000
```

heq also picks up shell environment variables by default. If you have `HEQ_PORT`,
`HEQ_REDIS_URL` or `HEQ_REDIS_NAMESPACE` available in your env, these values will
be selected (**explicit program arguments will always win**).

## Run in background

heq does not have any opinions about how to keep servers running in background.
You can use docker, pm2, or any other process management tools. Personally, if I want to run heq locally, I use pm2 with the following command:

```
> pm2 start --name "heq-local" -x "npx" -- heq --port=9000
```

This way you can start multiple `heq-server` instances for different projects, listening on different ports. These instances will run in background, and depends with [`pm2 startup`](https://pm2.io/doc/en/runtime/guide/startup-hook/) setup, they will reinitialize after system restarts.
