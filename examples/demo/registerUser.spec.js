const getJerniDevInstance = require("jerni-dev/test");

const registerUser = require("./registerUser.js");

async function getDevJourney(url, dbName, initial = []) {
  process.env.MONGODB_URL = "mongodb://localhost:27017";
  process.env.MONGODB_DBNAME = "registerUser-test-1";
  const journey = await require("./my-journey")();

  const testJourney = getJerniDevInstance(journey, initial);

  return testJourney;
}

describe("registerUser", () => {
  it("should insert new user to Users collection", async () => {
    const journey = await getDevJourney(
      "mongodb://localhost:27017",
      "registerUser-test-1",
    );

    const user = await registerUser(journey, {
      fullName: "test",
      email: "test@email.com",
    });

    expect(user).toEqual(
      expect.objectContaining({
        fullName: "test",
        email: "test@email.com",
        id: expect.any(String),
      }),
    );

    await journey.dispose();

    expect(journey.committed).toEqual([
      expect.objectContaining({
        type: "USER_REGISTERED",
        payload: {
          fullName: "test",
          email: "test@email.com",
          id: expect.any(String),
        },
      }),
    ]);
  });
});
