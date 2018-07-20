const { spawn } = require('child_process');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const start = async ({ args = [], timeoutMs = 300 } = {}) =>
  new Promise((resolve, reject) => {
    const heq = spawn('node', ['index', ...args]);
    const buffer = [];

    const killHeq = async () => {
      heq.kill();

      // wait for cleanup to be done
      await sleep(10);
      const output = buffer.join('\n');
      resolve(output);
    };

    heq.stderr.on('data', data => {
      reject(new Error(String(data)));
    });

    heq.stdout.on('data', data => {
      if (!timeoutMs) {
        killHeq();
      }
      buffer.push(String(data));
    });

    if (timeoutMs) setTimeout(killHeq, timeoutMs);
  });

exports.start = start;
