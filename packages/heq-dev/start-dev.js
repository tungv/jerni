const withUI = require('./withUI');
const withDevAPI = require('./withDevAPI');

module.exports = async opts => {
  const factory = require('heq-server');
  const ip = require('ip');
  const micro = require('micro');

  const { port: PUBLIC_PORT } = opts;

  const adapter = require('@heq/server-lokijs');

  const queue = await adapter({
    ns: opts.namespace,
  });

  const service = await factory({ queue });
  const devService = await withDevAPI(service, queue);
  const serviceWithUI = await withUI(devService);
  const server = micro(serviceWithUI);

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
    console.log(`using @heq/server-lokijs implementation (${opts.namespace})`);
    console.log(
      `public API is listening on http://${ipAddress}:${PUBLIC_PORT}`
    );
  });
};
