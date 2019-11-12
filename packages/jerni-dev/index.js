const colors = require("ansi-colors");

const { URL } = require("url");
const fs = require("fs");
const got = require("got");
const path = require("path");

const pkgDir = require("pkg-dir");

const getRunningServerUrl = () => {
  const rootDir = pkgDir.sync();
  const filepath = path.resolve(rootDir, "./.jerni-dev");
  return fs.existsSync(filepath) ? String(fs.readFileSync(filepath)) : null;
};

const validServer = async url => {
  if (!url) return false;

  try {
    const {
      body: { id },
    } = await got(`${url}/events/latest`, { json: true });

    return typeof id === "number";
  } catch (ex) {
    return false;
  }
};

const FIRST = colors.dim("1)");
const SECOND = colors.dim("2)");
const JERNI_DEV = colors.bold("jerni-dev");

// prettier-ignore
const fixUrlGuide = `
  ${FIRST} if you're in ${colors.bold.green("development")} mode, make sure you ran ${JERNI_DEV}.
  ${SECOND} if you're in ${colors.bold.green("production")} mode, please set ${colors.bold("NODE_ENV=production")} before starting your app
`;

const WARNING = colors.bgYellow.bold(" jerni-dev ");
const ERROR = colors.bgRed.bold(" jerni-dev ");
const INFO = colors.bgGreen.bold(" jerni-dev ");

exports.getDevServerUrl = async providedServerUrl => {
  const devServerUrl = getRunningServerUrl();
  if (!devServerUrl) {
    if (await validServer(providedServerUrl)) {
      console.log(
        `${WARNING} cannot detect jerni-dev server, use the provided ${colors.yellow(
          providedServerUrl,
        )}.\n${fixUrlGuide}`,
      );
      return providedServerUrl;
    }

    console.log(
      `${ERROR} invalid jerni server provided, received: ${colors.bold.red(
        providedServerUrl,
      )}.\n${fixUrlGuide}\n`,
    );

    process.exit(1);
  }

  console.log(`${INFO} forwarding events to dev server at ${devServerUrl}`);

  return devServerUrl;
};

exports.waitTooLongExplain = ({ stores, event }) => {
  const EVENT_FMT = colors.bold.underline(`#${event.id} - ${event.type}`);
  console.log(`${ERROR} wait too long for event ${EVENT_FMT}\n`);

  const devServerUrl = getRunningServerUrl();
  const sentToDev = event.meta.sent_to === devServerUrl;

  if (sentToDev) {
    console.log(
      `  please check the connections from your computer to remote stores`,
    );
    stores.forEach((store, index) => {
      console.log(`  ${colors.dim(`${index + 1})`)} ${store.toString()}`);
    });
    return;
  }

  if (devServerUrl && !sentToDev) {
    console.log(
      `  you're not sending events to ${JERNI_DEV} server. Events are being sent to ${colors.red(
        event.meta.sent_to,
      )}. Make sure you run ${JERNI_DEV} before sending events`,
    );

    return;
  }

  console.log(`  you're not running ${JERNI_DEV} server.\n`);
  console.log(
    `  ${FIRST} if you want to use ${JERNI_DEV} as your subscriber,
     please run ${JERNI_DEV} before sending events
`,
  );

  console.log(
    `  ${SECOND} if you want to use a different subscriber,
     make sure it's running and able to connect to your stores
`,
  );
  stores.forEach(store => {
    const url = new URL(store.url);
    console.log(`     ${colors.dim(`*`)} ${url.protocol}//${url.host}`);
  });

  console.log("\n");
};
