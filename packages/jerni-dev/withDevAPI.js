const { router, get } = require("microrouter");
const { sendError } = require("micro");

const getPulses = require("./utils/getPulses");

module.exports = async function(next, queue) {
  return router(
    get("/dev/filter", req => {
      return req.query;
    }),
    get("/dev/events/:id", async (req, res) => {
      const event = await queue.getEvent(req.params.id);
      if (!event) {
        sendError(req, res, {
          statusCode: 404,
          message: "Not Found"
        });

        return;
      }
      return event;
    }),
    get("/dev/pulses", async () => {
      const { coll: Pulses } = await getPulses();
      const pulses = Pulses.find();

      return Promise.all(
        pulses.map(async p => {
          const { events, ...others } = p;
          const fullEvents = await Promise.all(
            events.map(id => queue.getEvent(id))
          );

          return { events: fullEvents, ...others };
        })
      );
    }),
    next
  );
};
