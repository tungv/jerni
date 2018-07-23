module.exports = {
  users: [
    {
      version: '1.0.0',
      when: event => event.type === 'USER_CREATED',
      dispatch: event => ({
        insert: [
          {
            id: event.payload.id,
            username: event.payload.username,
            hashed_password: event.payload.hashed_password,
          },
        ],
      }),
    },
    {
      version: '1.0.0',
      when: event => event.type === 'PASSWORD_CHANGED',
      dispatch: event => ({
        update: {
          where: {
            id: event.payload.id,
          },
          changes: {
            $set: {
              hashed_password: event.payload.hashed_password,
            },
          },
        },
      }),
    },
  ],
};
