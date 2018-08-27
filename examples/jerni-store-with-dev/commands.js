const nanoid = require("nanoid");

const people = require("../models/people");

exports.registerNewPerson = async (store, { fullName, bornAt }) => {
  // generate a unique id. This is an example of side-effect. Side-effects should be carried out in
  // commands, not rules.
  const id = nanoid();

  // commit to event server and wait until it's fully committed to heq-server
  const event = await store.commit({
    type: "PERSON_REGISTERED",
    payload: {
      id,
      full_name: fullName,
      born_at: bornAt
    }
  });

  // wait for read-side to fully persist
  await store.waitFor(event);

  const PeopleCollection = store.getReader(people);

  return PeopleCollection.findOne({ id });
};

exports.registerNewBorn = async (store, { fatherId, motherId, children }) => {
  // validation
  const PeopleCollection = store.getReader(people);

  const father = await PeopleCollection.findOne({ id: fatherId });
  const mother = await PeopleCollection.findOne({ id: motherId });

  if (!father || !mother) {
    throw new Error("invalid parent IDs");
  }

  const payload = {
    parents: [fatherId, motherId],
    children: children.map(child =>
      Object.assign(
        {
          id: nanoid()
        },
        child
      )
    )
  };

  // send event and wait until it's fully commited to heq-server
  const event = await store.commit({ type: "CHILDREN_BORN", payload });

  // at this moment, read-side hasn't persisted yet.
  // since in this example, we don't want to wait for persistence to complete.
  // we can return immediately by optimistically guess the read-side data
  const optimisticParents = people.applyUpdate(event, [father, mother]);

  return {
    father: optimisticParents[0],
    mother: optimisticParents[1]
  };
};
