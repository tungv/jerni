module.exports = async function getUsersCollection(journey) {
  const Users = await journey.getReader(require("./models/users"));
  return Users;
};
