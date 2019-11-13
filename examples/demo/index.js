const generate = require("nanoid/generate");
const express = require("express");
const app = express();

app.use(express.json());

const initializer = require("./my-journey");
const journeyPromise = initializer();

async function getUsersCollection() {
  const journey = await journeyPromise;
  const Users = await journey.getReader(require("./models/users"));
  return Users;
}

async function registerUser(user) {
  const journey = await journeyPromise;
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

  const Users = await getUsersCollection();
  return Users.findOne({ id: userId });
}

async function getAllUsers() {
  const Users = await getUsersCollection();
  const users = await Users.find({}).toArray();

  return users.map(user => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  }));
}

app.get("/api/users", function(req, res) {
  getAllUsers().then(users => {
    res.json(users);
  });
});

app.post("/api/users", function(req, res) {
  const body = req.body;
  registerUser(body)
    .then(user => {
      res.json({
        status: "created",
        data: user,
      });
    })
    .catch(ex => {
      if (ex.name === "JerniPersistanceTimeout") {
        res.status(202);
        res.json({ status: "accepted", data: null });
      } else {
        console.error(ex);
        res.status(400);
        res.json({ status: "failed", data: ex });
      }
    });
});

app.listen(3000);
console.log("express app is listening on port 3000");
