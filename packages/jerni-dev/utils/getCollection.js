const Loki = require('lokijs');

module.exports = async (filename, collectionName) => {
  return new Promise(resolve => {
    const db = new Loki(filename, {
      autosave: true,
      autoload: true,
      autosaveInterval: 4000,
      autoloadCallback: () => {
        let coll = db.getCollection(collectionName);

        if (coll == null) {
          coll = db.addCollection(collectionName);
        }

        resolve({ coll, db });
      },
    });
  });
};
