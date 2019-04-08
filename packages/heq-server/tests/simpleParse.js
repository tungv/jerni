module.exports = function simpleParse(buffer) {
  const chunks = buffer.split("\n\n").filter(x => x);

  if (chunks[0] !== ":ok") {
    throw new Error("not ok");
  }

  const events = chunks.map(ch => {
    const lines = ch.split("\n");
    if (lines[1] !== "event: INCMSG") {
      return [];
    }

    return JSON.parse(lines[2].slice("data: ".length));
  });

  return [].concat(...events);
};
