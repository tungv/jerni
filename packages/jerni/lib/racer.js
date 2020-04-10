const partition = require("./partition");

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
    max() {
      return Math.max(...initialArray);
    },
    min() {
      return Math.min(...initialArray);
    },
    versions(index) {
      return initialArray[index];
    },
    reset() {
      for (let i = 0; i < initialArray.length; ++i) {
        initialArray[i] = 0;
      }
    },
  };
};

module.exports = makeRacer;

function makeDefer() {
  let resolve, reject;

  const promise = new Promise((_1, _2) => {
    resolve = _1;
    reject = _2;
  });
  return {
    promise,
    resolve,
    reject,
  };
}
