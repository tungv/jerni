// this is a unit test
const getAllUsers = require("./getAllUsers");
const getTestJourney = require("./getTestJourney.js");

describe("getAllUsers", () => {
  it("should return empty array before any user registration", async () => {
    const journey = await getTestJourney(
      "mongodb://localhost:27017",
      "test-empty-users",
      [],
    );

    try {
      const users = await getAllUsers(journey);
      expect(users).toHaveLength(0);
    } finally {
      await journey.dispose();
    }
  });

  it("should return all registered users", async () => {
    const journey = await getTestJourney(
      "mongodb://localhost:27017",
      "test-existing-users",
      [
        {
          type: "USER_REGISTERED",
          payload: {
            id: "abc",
            email: "test_1@abc.com",
            fullName: "test 1",
          },
        },
        {
          type: "USER_REGISTERED",
          payload: {
            id: "xyz",
            email: "test_2@abc.com",
            fullName: "test 2",
          },
        },
      ],
    );

    try {
      const users = await getAllUsers(journey);
      expect(users).toHaveLength(2);
    } finally {
      await journey.dispose();
    }
  });
});
