const commitEventToHeqServer = require('./commit');
const makeRacer = require('./racer');

module.exports = function initStore({ writeTo, readFrom }) {
  const racer = makeRacer(readFrom.map(() => 0));

  readFrom.forEach((model, index) => {
    model.subscribe(id => {
      racer.bump(index, id);
    });
  });

  const read = model => {
    return model.getReadOnlyInstance();
  };

  const commit = event => {
    return commitEventToHeqServer(`${writeTo}/commit`, event);
  };

  const waitFor = event => {
    return racer.wait(event.id);
  };

  return {
    read,
    commit,
    waitFor,
  };
};
