const backoff = ({ seed, max = Number.MAX_VALUE }) => {
  let ms = 0;
  let nxt = seed;

  return {
    next() {
      [ms, nxt] = [nxt, ms + nxt];
      return Math.min(ms, max);
    },

    reset() {
      ms = 0;
      nxt = seed;
    }
  };
};

module.exports = backoff;
