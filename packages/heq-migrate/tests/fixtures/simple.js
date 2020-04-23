module.exports = function (event) {
  if (event.type === "type_1" || event.type === "type_2") {
    return false;
  }

  return true;
};
