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
