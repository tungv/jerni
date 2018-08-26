const makeDefer = require('./makeDefer');
const partition = require('./partition');

const makeRacer = initialArray => {
  let buffer = [];

  return {
    wait(id) {
      const defer = makeDefer();
      buffer.push([id, defer]);

      return defer.promise;
    },
    bump(index, id) {
      const prevOldest = Math.min(...initialArray);
      initialArray[index] = id;
      const currentOldest = Math.min(...initialArray);

      if (currentOldest > prevOldest) {
        const [yes, no] = partition(buffer, ([id]) => id <= currentOldest);

        buffer = no;
        yes.forEach(([id, defer]) => defer.resolve());
      }
    },
  };
};

module.exports = makeRacer;
