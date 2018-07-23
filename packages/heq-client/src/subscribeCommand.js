import execa from 'execa';
import { createServer } from 'http';
import prettyMs from 'pretty-ms';

import path from 'path';

export default async ({ json, verbose, config }) => {
  const startTime = Date.now();
  // start a subscribe worker
  const configPath = path.resolve(process.cwd(), config);
  const params = JSON.stringify({
    json,
    verbose: verbose || 'INFO',
    configPath,
  });
  const executable = path.resolve(__dirname, './subscribe.js');

  process.on('SIGINT', () => {
    // maximum 1s for worker to cleanup
    setTimeout(process.exit, 1000, 0);
  });

  const simpleConfig = require(configPath);
  if (simpleConfig.monitor && simpleConfig.monitor.port) {
    const server = createServer((req, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    server.listen(simpleConfig.monitor.port, err => {
      if (err) {
        console.error(
          'cannot start http server on port %s. Exitting...',
          simpleConfig.monitor.port
        );
        process.exit(1);
        return;
      }
      console.log(
        'monitoring server is listening on port',
        simpleConfig.monitor.port
      );
    });
  }

  const worker = execa('node', ['-r', 'babel-register', executable], {
    env: { params },
    silent: true,
    stdio: 'inherit',
  });

  try {
    await worker;
  } catch (ex) {
    if (ex.code !== 0) {
      process.exit(ex.code);
    }
  } finally {
    console.log('✨ done in', prettyMs(Date.now() - startTime));
  }
};
