const Loki = require('lokijs');
const mitt = require('mitt');
const kefir = require('kefir');

const delokize = obj => {
  const { $loki, ...event } = { ...obj };
  event.meta = { ...obj.meta };

  event.id = $loki;

  delete event.meta.created;
  delete event.meta.revision;
  delete event.meta.version;

  if (Object.keys(event.meta).length === 0) {
    delete event.meta;
  }

  return event;
};

const adapter = ({ ns = 'local' }) => {
  const emitter = mitt();
  const db = new Loki('heq-events.json');
  const events = db.addCollection('events');
  let latest = null;

  const commit = async event => {
    latest = events.insert({ ...event, meta: { ...event.meta } });
    emitter.emit('data', latest);
    event.id = latest.$loki;

    return event;
  };

  const getLatest = async () => {
    return latest ? delokize(latest) : { id: 0, type: '@@INIT' };
  };

  const query = async ({ from = -1, to }) => {
    if (from === -1) {
      return [];
    }

    if (to) {
      return events.find({ $loki: { $between: [from + 1, to] } }).map(delokize);
    }

    return events.find({ $loki: { $gt: from } }).map(delokize);
  };

  const subscribe = () => ({
    events$: kefir.fromEvents(emitter, 'data').map(delokize),
  });

  const destroy = () => {
    // noop
  };

  return { commit, subscribe, query, destroy, getLatest };
};

module.exports = adapter;
