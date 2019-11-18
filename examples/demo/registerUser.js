const getUsersCollection = require("./getUsersCollection.js");

const generate = require("nanoid/generate");

module.exports = async function registerUser(journey, user) {
  const userId = generate(
    "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ",
    12,
  );

  if (!user.email || !user.fullName) {
    throw new Error("invalid user");
  }

  const event = await journey.commit({
    type: "USER_REGISTERED",
    payload: {
      id: userId,
      email: user.email,
      fullName: user.fullName,
    },
  });

  await journey.waitFor(event);

  const Users = await getUsersCollection(journey);
  return Users.findOne({ id: userId });
};
