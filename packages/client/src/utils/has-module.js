module.exports = function hasModule(name) {
  try {
    require.resolve(name);
    return true;
  } catch (e) {
    return false;
  }
};
