const path = require('path');
const startDevServer = require('./start-dev');

module.exports = async function subscribeDev(filepath, opts) {
  console.log('loading store');
  console.time('store loaded');
  const mod = await require(path.resolve(process.cwd(), filepath));
  const defExport = mod.default || mod;
  const store = await defExport;

  console.timeEnd('store loaded');

  console.log('starting server');

  console.time('server started');
  const server = await startDevServer({
    port: opts.port,
    namespace: 'local-dev',
  });
  console.timeEnd('server started');

  const { port } = server.address();
  console.log({ port });

  store.replaceWriteTo(`http://localhost:${port}`);

  const stream = await store.subscribe();

  const subscription = stream.observe(out => {
    console.log(require('util').inspect(out.output, { depth: 4 }));
  });
  // process.exit(0);
};
