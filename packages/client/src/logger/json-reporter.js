export default (level, data) => {
  console.log(
    JSON.stringify(
      Object.assign(
        {
          _t: Date.now(),
          _l: level,
        },
        data
      )
    )
  );
};
