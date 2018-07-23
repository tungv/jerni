const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms));

let delay = 0;

module.exports = [
  {
    when: {
      type: 'USER_REGISTERED',
    },
    execute: async event => {
      delay += 100;
      await sleep(delay);
      console.log(
        '------------------------------------ side effect',
        event.payload.uid
      );
    },
  },
  {
    when: (event, projections) => {
      return (
        event.type === 'USER_EMAIL_UPDATED' && event.payload.email === 'failing'
      );
    },
    execute: async event => {
      throw new Error('must fail');
    },
  },
];
