#!/usr/bin/env node

import sade from 'sade';

import { version, bin } from '../package.json';
import subscribeCommand from './subscribeCommand';

const binName = Object.keys(bin)[0];
const program = sade(binName);

program
  .version(version)
  .option('--json', 'output logs in JSON format', false)
  .option(
    '--verbose, -x',
    'level of log can be either SILLY, DEBUG, INFO, WARN, ERROR, or FATAL',
    'INFO'
  );

program
  .command('subscribe', '', {
    default: true,
  })
  .describe(
    'start to subscribe to an heq server and persist data to a datastore'
  )
  .option('--config, -c', 'path to config file', 'events.config.js')
  .example('subscribe --config path/to/config.js')
  .action(subscribeCommand);

program.parse(process.argv);
