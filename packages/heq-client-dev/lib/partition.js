module.exports = (array, condition) => {
  const left = [];
  const right = [];

  for (const item of array) {
    if (condition(item)) {
      left.push(item);
    } else {
      right.push(item);
    }
  }

  return [left, right];
};
