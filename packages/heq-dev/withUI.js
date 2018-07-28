const next = require('next');
const { parse } = require('url');
const { router, get } = require('microrouter');

module.exports = async function(service) {
  const dev = process.env.NODE_ENV === 'heq_development';

  const app = next({ dev });

  const handle = app.getRequestHandler();

  await app.prepare();

  return (req, res) => {
    const parsedUrl = parse(req.url, true);

    const { pathname } = parsedUrl;

    if (pathname.match(/^\/(query|subscribe|commit|events)/)) {
      return service(req, res);
    }

    return handle(req, res, parsedUrl);
  };
};
