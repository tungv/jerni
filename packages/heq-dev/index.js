#!/usr/bin/env node
const sade = require('sade');
const program = sade('heq-dev');

const { version } = require('./package.json');

program.version(version).option('banner', 'BANNER FTW', false);

const { HEQ_LOKIJS_NAMESPACE = 'local', HEQ_PORT = '8080' } = process.env;

program
  .command(
    'start',
    'start a heq-server instead using local database implementation',
    { default: true }
  )
  .option('namespace', 'name', HEQ_LOKIJS_NAMESPACE)
  .option('port', 'http port to listen', Number.parseInt(HEQ_PORT, 10))
  .action(opts => {
    if (opts.banner) {
      require('./banner');
    }
    require('./start-dev')(opts);
  });

program.parse(process.argv);
