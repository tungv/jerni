const registerUser = require("./registerUser.js");
const getTestJourney = require("./getTestJourney.js");

describe("registerUser", () => {
  it("should insert new user to Users collection", async () => {
    const journey = await getTestJourney(
      "mongodb://localhost:27017",
      "registerUser-test-1",
    );

    try {
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
    } finally {
      await journey.dispose();
    }
  });
});
