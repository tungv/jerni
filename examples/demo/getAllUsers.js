const getUsersCollection = require("./getUsersCollection");
module.exports = async function getAllUsers(journey) {
  const Users = await getUsersCollection(journey);
  const users = await Users.find({}).toArray();

  return users.map(user => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  }));
};
