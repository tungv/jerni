const express = require("express");

const getAllUsers = require("./getAllUsers");
const registerUser = require("./registerUser");

const app = express();

app.use(express.json());

const initializer = require("./my-journey");
const journeyPromise = initializer();

app.get("/api/users", async function(req, res) {
  const users = await getAllUsers(await journeyPromise);

  return users;
});

app.post("/api/users", async function(req, res) {
  const body = req.body;
  try {
    const user = await registerUser(await journeyPromise, body);
    return res.json({
      status: "created",
      data: user,
    });
  } catch (ex) {
    if (ex.name === "JerniPersistanceTimeout") {
      res.status(202);
      res.json({ status: "accepted", data: null });
    } else {
      console.error(ex);
      res.status(400);
      res.json({ status: "failed", data: ex });
    }
  }
});

app.listen(3000);
console.log("express app is listening on port 3000");
