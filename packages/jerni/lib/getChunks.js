const getChunks = raw$ => {
  return raw$
    .scan(
      ([complete, buf], raw) => {
        // console.log(complete, buf, raw);
        const chunks = raw.split('\n\n');

        // incomplete chunk
        if (chunks.length === 1) {
          return [[], buf + chunks[0]];
        }

        const firstChunks = (buf + chunks[0]).split('\n\n');

        return [
          firstChunks.concat(chunks.slice(1, -1)),
          chunks[chunks.length - 1],
        ];
      },
      [[], '']
    )
    .flatten(([complete]) => complete)
    .map(complete => {
      if (!complete) {
        return {};
      }

      const props = complete.split('\n');

      return props.reduce((obj, str) => {
        const splited = str.split(': ');

        if (splited.length >= 2) {
          const key = splited[0];
          const value = splited.slice(1).join(': ');
          obj[key] = key === 'id' ? Number(value) : value;
        }
        return obj;
      }, {});
    })
    .filter(obj => Object.keys(obj).length);
};

module.exports = getChunks;
