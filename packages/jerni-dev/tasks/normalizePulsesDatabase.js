module.exports = Pulses => {
  const pulses = Pulses.find({});
  Pulses.clear();

  const eventIds = {};

  pulses.forEach(pulse => {
    const events = pulse.events.filter(id => {
      if (eventIds[id]) {
        return false;
      }

      eventIds[id] = true;
      return true;
    });

    if (events.length) {
      Pulses.insert({
        events,
        models: pulse.models
      });
    }
  });
};
