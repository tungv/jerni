const isPulseEmpty = ({ models }) =>
  models.every(model => model.added + model.modified + model.removed === 0);

const mergePulses = (prev, current) => {
  if (!prev) {
    return [current];
  }
  if (isPulseEmpty(prev) && isPulseEmpty(current)) {
    return [
      {
        ...prev,
        events: [...prev.events, ...current.events],
      },
    ];
  }

  return [current, prev];
};

const pulses = (state = [], { type, payload }) => {
  if (type === 'PULSES_INTIALIZED') {
    return payload.reduce((pulses, current) => {
      const lastPulse = pulses[0];
      const everythingButLast = pulses.slice(1);
      const mergedOrPrependPulses = mergePulses(lastPulse, current);

      return [...mergedOrPrependPulses, ...everythingButLast];
    }, state);
  }

  if (type === 'SERVER/PULSE_ARRIVED') {
    const lastPulse = state[0];
    const everythingButLast = state.slice(1);

    return [...mergePulses(lastPulse, payload), ...everythingButLast];
  }

  return state;
};

export default {
  pulses,
};
