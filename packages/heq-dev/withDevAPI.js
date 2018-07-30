const { sendError } = require('micro');

const { router, get } = require('microrouter');

module.exports = async function(next, queue) {
  return router(
    get('/dev/filter', req => {
      return req.query;
    }),
    get('/dev/events/:id', async (req, res) => {
      const id = Number.parseInt(req.params.id, 10);
      const data = await queue.query({ from: id - 1, to: id });
      if (!data[0]) {
        sendError(req, res, {
          statusCode: 404,
          message: 'Not Found',
        });

        return;
      }
      return data[0];
    }),
    next
  );
};
