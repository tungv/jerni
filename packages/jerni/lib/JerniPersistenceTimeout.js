module.exports = class JerniPersistenceTimeout extends Error {
  constructor(event) {
    super("JerniPersistenceTimeout");

    this.name = "JerniPersistenceTimeout";
    this.message = `Timeout: wait too long for #${event.id} - ${event.type}`;
    this.data = {
      id: event.id,
      type: event.type,
    };
  }
};
