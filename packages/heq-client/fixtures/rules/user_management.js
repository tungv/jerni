module.exports = {
  users: [
    {
      version: '1.0.0',
      when: ({ type }) => type === 'USER_REGISTERED',
      dispatch: ({ payload }) => ({
        insert: [payload],
      }),
    },
    {
      version: '1.0.0',
      when: ({ type }) => type === 'USER_EMAIL_UPDATED',
      dispatch: ({ payload }) => ({
        update: {
          where: { uid: payload.uid },
          changes: { $set: { email: payload.email } },
        },
      }),
    },
  ],
  departments: [
    {
      version: '1.0.0',
      when: ({ type }) => type === 'DEPARTMENT_CREATED',
      dispatch: ({ payload }) => ({
        insert: [payload],
      }),
    },
    {
      version: '1.0.0',
      when: ({ type }) => type === 'USER_REGISTERED',
      dispatch: ({ payload }) => ({
        update: {
          where: {
            id: payload.department_id,
          },
          changes: {
            $inc: { members: 1 },
          },
        },
      }),
    },
  ],
};
