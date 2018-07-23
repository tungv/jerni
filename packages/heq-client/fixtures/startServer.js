import factory from '@events/server';
import nodeRedis from 'redis';
import del from 'redis-functional/del';
import enableDestroy from 'server-destroy';

let servers = {};

export const cleanup = () => {
  for (let port in servers) {
    const server = servers[port];
    console.log('closing', port);
    server.destroy();
    delete servers[port];
  }
};

export default function({ namespc, redis, port, clean = false }) {
  if (servers[port]) {
    throw new Error(`port ${port} is in use`);
  }

  let p = Promise.resolve(true);

  if (clean) {
    p = p.then(async () => {
      const client = nodeRedis.createClient(redis);
      await del(client, `{${namespc}}::id`);
      await del(client, `{${namespc}}::events`);

      client.quit();
    });
  }

  return p.then(
    () =>
      new Promise(resolve => {
        const server = factory({
          namespc,
          redis: { url: redis },
          history: { size: 10 },
          debug: false,
        });

        enableDestroy(server);

        server.on('close', () => {
          console.log('closing', port);
          delete servers[port];
        });

        server.listen(port, () => {
          servers[port] = server;
          resolve(server);
        });
      })
  );
}
