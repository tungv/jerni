#!/usr/bin/env node
const sade = require('sade');

const program = sade('heq');

const {
  HEQ_REDIS_URL = 'redis://localhost:6379',
  HEQ_REDIS_NAMESPACE = 'local',
  HEQ_PORT = '8080',
} = process.env;

program.version('2.0.0').option('banner', 'BANNER FTW', false);

program
  .command(
    'start',
    'start a heq-server instead using @heq/server-redis implementation',
    { default: true }
  )
  .option('redis', 'URL to redis server', HEQ_REDIS_URL)
  .option('redis-namespace', 'name', HEQ_REDIS_NAMESPACE)
  .option('port', 'http port to listen', Number.parseInt(HEQ_PORT, 10))
  .action(opts => {
    if (opts.banner) {
      require('brighten');
      require('./banner');
    }
    require('./start')(opts);
  });

program.parse(process.argv);
