const returnEmptyOnException = fn => {
  return (...args) => {
    try {
      return fn(...args);
    } catch (ex) {
      if (process.env.NODE_ENV === 'test') {
        console.error(ex);
      }
      return null;
    }
  };
};

module.exports = returnEmptyOnException;
