#!/usr/bin/env node
const sade = require('sade');
const program = sade('heq-dev');

const { version } = require('./package.json');

program.version(version).option('banner', 'BANNER FTW', false);

const { HEQ_LOKIJS_NAMESPACE = 'local', HEQ_PORT = '8080' } = process.env;

program.option('port', 'http port to listen', Number.parseInt(HEQ_PORT, 10));

program
  .command(
    'start',
    'start a heq-server instead using local database implementation',
    { default: true }
  )
  .option('namespace', 'name', HEQ_LOKIJS_NAMESPACE)
  .action(opts => {
    if (opts.banner) {
      require('./banner');
    }
    require('./start-dev')(opts).catch(err => {
      console.error('cannot start server', err);
      process.exit(1);
    });
  });

program
  .command(
    'subscribe <path>',
    'subscribe to a heq-store instance with an integrated heq-server'
  )
  .action((path, opts) => {
    if (opts.banner) {
      require('./banner');
    }

    require('./subscribe-dev')(path, opts);
  });

program.parse(process.argv);
