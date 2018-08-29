const { sendError } = require("micro");
const path = require("path");
const { router, get } = require("microrouter");
const getCollection = require("./utils/getCollection");
const DEV_DIR = path.resolve(process.cwd(), "./.jerni-dev");

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
      const { coll: Pulses } = await getCollection(
        path.resolve(DEV_DIR, "pulses.json"),
        "pulses"
      );
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
