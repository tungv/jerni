const colors = require("ansi-colors");
const pkgDir = require("pkg-dir");

const { URL } = require("url");
const fs = require("fs");
const got = require("got");
const path = require("path");
const { watch } = require("chokidar");

const rootDir = pkgDir.sync();
const filepath = path.resolve(rootDir, "./.jerni-dev");
const jerniDevVersion = require("./package.json").version;

const getRunningServerUrl = () => {
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

exports.getDevServerUrl = async function(providedServerUrl, event) {
  const devServerUrl = getRunningServerUrl();
  if (!devServerUrl) {
    if (await validServer(providedServerUrl)) {
      console.log(
        `${WARNING} cannot detect ${JERNI_DEV} server, use the provided ${colors.yellow(
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

  return devServerUrl;
};

exports.logCommitted = function(url, event) {
  console.log(
    `${INFO} event #%s [type=%s] has been committed to dev server at %s`,
    colors.bold(event.id),
    colors.bold(event.type),
    printURL(url),
  );
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

function printURL(url) {
  if (!url) {
    return colors.italic.dim("undefined");
  }
  return colors.italic.underline.green(url);
}

exports.connectDevServer = async function(config, onRestarted) {
  const watcher = watch(filepath);

  let devServerUrl = await getRunningServerUrl();

  if (devServerUrl) {
    console.log(
      `${INFO} running in development mode

  versions:
    jerni:     %s
    jerni-dev: %s

  heq-server:
    original URL: %s (not used in development mode)
    dev server URL: %s
    
  stores:
    - ${config.stores.map(store => printURL(store.toString())).join(`
    - `)}
  \n`,
      colors.bold(config.version),
      colors.bold(jerniDevVersion),
      colors.dim(printURL(config.writeTo)),
      printURL(devServerUrl),
    );
  }

  watcher.on("add", function() {
    const devServer = String(fs.readFileSync(filepath));
    if (devServerUrl === devServer) {
      return;
    }
    console.log(
      `${INFO} ${JERNI_DEV} server has restarted at %s`,
      printURL(devServer),
    );

    if (typeof onRestarted === "function") {
      onRestarted();
    }
  });

  watcher.on("unlink", function() {
    console.log(
      `${WARNING} ${JERNI_DEV} server has shut down.
      
  ${FIRST} %s will throw until ${JERNI_DEV} server is fully restarted.
  ${SECOND} after restarting, all of your events will be replayed.\n`,
      colors.inverse.italic(" journey.commit(event) "),
    );
    devServerUrl = null;
  });
};
