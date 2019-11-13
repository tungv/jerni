const __DEVTOOL__ = (() => {
  try {
    require("jerni-dev");
    return true;
  } catch (ex) {
    console.error("please install jerni-dev for better development experience");
    return false;
  }
})();

exports.logCommitted = function(url, event) {
  if (!__DEVTOOL__) return;

  return require("jerni-dev").logCommitted(url, event);
};

exports.getDevServerUrl = async providedServerUrl => {
  if (!__DEVTOOL__) return providedServerUrl;

  return require("jerni-dev").getDevServerUrl(providedServerUrl);
};
exports.waitTooLongExplain = ({ stores, event }) => {
  if (!__DEVTOOL__) return;

  return require("jerni-dev").waitTooLongExplain({ stores, event });
};

exports.getLogger = () => {
  if (!__DEVTOOL__) return console;

  const getLogger = require("jerni-dev/cli/dev-logger");

  return getLogger({ service: "jerni", verbose: false });
};

let watched = false;
exports.connectDevServer = async function connectDevServer(
  config,
  onRestarted,
) {
  if (watched) {
    return;
  }

  await require("jerni-dev").connectDevServer(config, onRestarted);
  watched = true;
};
