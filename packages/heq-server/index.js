const ports = require('port-authority');
const ip = require('ip');
const factory = require('./src/factory');
const boxen = require('boxen');

const start = async () => {
  const port = await ports.find(3000);
  const config = {
    http: {
      port,
    },
  };

  const { start } = await factory(config);

  const server = await start();

  const ipAddress = ip.address();

  console.log(
    boxen(`dev server is starting on http://${ipAddress}:${port}`, {
      padding: 1,
      borderColor: 'green',
      margin: 1,
    })
  );
};

start();
