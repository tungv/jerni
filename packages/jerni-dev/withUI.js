const next = require("next");
const { parse } = require("url");

module.exports = async function(service) {
  const dev = process.env.NODE_ENV === "heq_development";

  const app = next({ dev, dir: __dirname });

  const handle = app.getRequestHandler();

  await app.prepare();

  return (req, res) => {
    const parsedUrl = parse(req.url, true);

    const { pathname } = parsedUrl;

    if (pathname.match(/^\/(query|subscribe|commit|events|dev)/)) {
      return service(req, res);
    }

    return handle(req, res, parsedUrl);
  };
};
