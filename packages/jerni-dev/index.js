const kleur = require("kleur");

const { URL } = require("url");
const fs = require("fs");
const got = require("got");
const path = require("path");

const { DEV_DIR } = require("./tasks/constants");

const getRunningServerUrl = () => {
  const filepath = path.resolve(DEV_DIR, "./dev-server.txt");
  return fs.existsSync(filepath) ? String(fs.readFileSync(filepath)) : null;
};

const validServer = async url => {
  if (!url) return false;

  try {
    const {
      body: { id }
    } = await got(`${url}/events/latest`, { json: true });

    return typeof id === "number";
  } catch (ex) {
    return false;
  }
};

const FIRST = kleur.dim("1)");
const SECOND = kleur.dim("2)");
const JERNI_DEV = kleur.bold("jerni-dev");

// prettier-ignore
const fixUrlGuide = `
  ${FIRST} if you're in ${kleur.bold.green("development")} mode, make sure you ran ${JERNI_DEV}.
  ${SECOND} if you're in ${kleur.bold.green("production")} mode, please set ${kleur.bold("NODE_ENV=production")} before starting your app
`;

const WARNING = kleur.bgYellow.bold(" jerni-dev ");
const ERROR = kleur.bgRed.bold(" jerni-dev ");
const INFO = kleur.bgGreen.bold(" jerni-dev ");

exports.getDevServerUrl = async providedServerUrl => {
  const devServerUrl = getRunningServerUrl();
  if (!devServerUrl) {
    if (await validServer(providedServerUrl)) {
      console.log(
        `${WARNING} cannot detect jerni-dev server, use the provided ${kleur.yellow(
          providedServerUrl
        )}.\n${fixUrlGuide}`
      );
      return providedServerUrl;
    }

    console.log(
      `${ERROR} invalid jerni server provided, received: ${kleur.bold.red(
        providedServerUrl
      )}.\n${fixUrlGuide}\n`
    );

    process.exit(1);
  }

  console.log(`${INFO} forwarding events to dev server at ${devServerUrl}\n`);

  return devServerUrl;
};

exports.waitTooLongExplain = ({ stores, event }) => {
  const EVENT_FMT = kleur.bold.underline(`#${event.id} - ${event.type}`);
  console.log(`${ERROR} wait too long for event ${EVENT_FMT}\n`);

  const devServerUrl = getRunningServerUrl();
  const sentToDev = event.meta.sent_to === devServerUrl;

  if (sentToDev) {
    console.log(
      `  please check the connections from your computer to remote stores`
    );
    stores.forEach((store, index) => {
      const url = new URL(store.url);
      console.log(
        `  ${kleur.dim(`${index + 1})`)} ${url.protocol}//${url.host}`
      );
    });
    return;
  }

  if (devServerUrl && !sentToDev) {
    console.log(
      `  you're not sending events to ${JERNI_DEV} server. Events are being sent to ${kleur.red(
        event.meta.sent_to
      )}. Make sure you run ${JERNI_DEV} before sending events`
    );

    return;
  }

  console.log(`  you're not running ${JERNI_DEV} server.\n`);
  console.log(
    `  ${FIRST} if you want to use ${JERNI_DEV} as your subscriber,
     please run ${JERNI_DEV} before sending events
`
  );

  console.log(
    `  ${SECOND} if you want to use a different subscriber,
     make sure it's running and able to connect to your stores
`
  );
  stores.forEach(store => {
    const url = new URL(store.url);
    console.log(`     ${kleur.dim(`*`)} ${url.protocol}//${url.host}`);
  });

  console.log("\n");
};
