module.exports = async opts => {
  const factory = require('heq-server');
  const ip = require('ip');
  const micro = require('micro');

  const { port: PUBLIC_PORT } = opts;

  const config = {
    queue: {
      driver: '@heq/server-redis',
      url: opts.redis,
      ns: opts['redis-namespace'],
    },
  };

  const service = await factory(config);
  const server = micro(service);

  process.on('SIGTERM', () => {
    console.log('terminating...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('interuptted! Goodbye');
    process.exit(0);
  });

  server.listen(PUBLIC_PORT, err => {
    if (err) {
      console.error('cannot start server');
      process.exit(1);
      return;
    }

    const ipAddress = ip.address();

    console.log(`heq-server started!`);
    console.log(`running locally on port ${PUBLIC_PORT}`);
    console.log(
      `using @heq/server-redis implementation (${opts['redis-namespace']} - ${
        opts.redis
      })`
    );
    console.log(
      `public API is listening on http://${ipAddress}:${PUBLIC_PORT}`
    );
  });
};
